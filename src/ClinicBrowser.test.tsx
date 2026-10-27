import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import KakaoClinicMap from './KakaoClinicMap'

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

const regions = [{ sido: '서울특별시', sigungus: ['종로구'] }]
const clinic = {
  id: 1,
  name: '튼튼동물병원',
  address: '서울특별시 종로구 길 1',
  phone: '02-123-4567',
  sido: '서울특별시',
  sigungu: '종로구',
  operatingStatus: 'OPEN',
  latitude: 37.566,
  longitude: 126.978,
  lastVerifiedAt: '2026-10-24T13:01:59Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  delete window.kakao
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
  window.history.replaceState({}, '', '/')
})

describe('veterinary clinic browser', () => {
  it('does not request location or home data on entry and keeps list fallback without a map key', async () => {
    const getCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    window.history.replaceState({}, '', '/clinics')
    vi.stubGlobal('fetch', vi.fn(() => response(regions)))

    render(<App />)

    expect(await screen.findByRole('heading', { name: '가까운 동물병원을 찾아보세요' })).toBeTruthy()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/veterinary-clinics/regions', expect.any(Object))
    expect(screen.getByText(/지도 키가 설정되지 않았습니다/)).toBeTruthy()
  })

  it('loads a selected region with the default open status', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/veterinary-clinics/regions') return response(regions)
      return response({ content: [clinic], number: 0, totalPages: 1, totalElements: 1 })
    }))
    window.history.replaceState({}, '', '/clinics')
    render(<App />)

    fireEvent.change(await screen.findByLabelText('시도'), { target: { value: '서울특별시' } })

    expect(await screen.findByText('튼튼동물병원')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/veterinary-clinics?sido=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&status=OPEN&page=0&size=12',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('requests geolocation only after the button and rounds coordinates before nearby search', async () => {
    let success: PositionCallback | undefined
    const getCurrentPosition = vi.fn((callback: PositionCallback) => { success = callback })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    const malicious = { ...clinic, name: '<img onerror=alert(1)>', distanceMeters: 312 }
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) =>
      String(input) === '/api/veterinary-clinics/regions'
        ? response(regions)
        : response({ content: [malicious], count: 1, truncated: false, radiusKm: 5 }),
    ))
    window.history.replaceState({}, '', '/clinics')
    render(<App />)
    await screen.findByText(/지도 키가 설정되지 않았습니다/)

    fireEvent.click(screen.getByRole('button', { name: '내 주변 병원 찾기' }))
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000,
    })
    success?.({ coords: { latitude: 37.56649, longitude: 126.97849 } } as GeolocationPosition)

    expect(await screen.findByText('<img onerror=alert(1)>')).toBeTruthy()
    expect(document.querySelector('.clinic-card img')).toBeNull()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/veterinary-clinics/nearby-search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ lat: 37.566, lng: 126.978, radiusKm: 5, limit: 20, status: 'OPEN' }),
      }),
    ))
  })

  it('removes stale clinic and user markers when map results change', async () => {
    vi.stubEnv('VITE_KAKAO_MAP_JS_KEY', 'test-key')
    const markers: FakeMarker[] = []
    class FakeLatLng { constructor(_lat: number, _lng: number) {} }
    class FakeBounds { extend = vi.fn() }
    class FakeMap {
      setBounds = vi.fn()
      setCenter = vi.fn()
      relayout = vi.fn()
      constructor(_container: HTMLElement, _options: object) {}
    }
    class FakeMarker {
      setMap = vi.fn()
      constructor(_options: object) { markers.push(this) }
    }
    window.kakao = {
      maps: {
        load: (callback) => callback(),
        LatLng: FakeLatLng,
        LatLngBounds: FakeBounds,
        Map: FakeMap,
        Marker: FakeMarker,
        services: {
          Status: { OK: 'OK' },
          AnalyzeType: { EXACT: 'EXACT' },
          Geocoder: class { addressSearch() {} },
        },
      },
    }
    const first = { id: 1, name: '첫 병원', latitude: 37.566, longitude: 126.978 }
    const second = { id: 2, name: '둘째 병원', latitude: 37.57, longitude: 127 }
    const view = render(<KakaoClinicMap clinics={[first]} userLocation={{ lat: 37.565, lng: 126.977 }} expanded />)
    await waitFor(() => expect(markers).toHaveLength(2))

    view.rerender(<KakaoClinicMap clinics={[second]} userLocation={null} expanded />)

    await waitFor(() => expect(markers).toHaveLength(3))
    expect(markers[0].setMap).toHaveBeenCalledWith(null)
    expect(markers[1].setMap).toHaveBeenCalledWith(null)
  })
})
