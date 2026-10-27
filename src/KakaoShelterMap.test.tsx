import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KakaoShelterMap, { verifiedShelterCoordinate } from './KakaoShelterMap'
import type { KakaoAddressResult, KakaoMaps } from './KakaoClinicMap'

const exactResult: KakaoAddressResult = {
  address_type: 'ROAD_ADDR',
  x: '126.889',
  y: '37.571',
}

function installKakao(results: KakaoAddressResult[], status = 'OK') {
  const addressSearch = vi.fn((
    _address: string,
    callback: (items: KakaoAddressResult[], resultStatus: string) => void,
  ) => callback(results, status))
  const latLng = vi.fn(function (latitude: number, longitude: number) {
    return { latitude, longitude }
  })
  const map = {
    setBounds: vi.fn(),
    setCenter: vi.fn(),
    relayout: vi.fn(),
  }
  const marker = { setMap: vi.fn() }
  const maps = {
    load: (callback: () => void) => callback(),
    LatLng: latLng,
    LatLngBounds: vi.fn(),
    Map: vi.fn(function () { return map }),
    Marker: vi.fn(function () { return marker }),
    services: {
      Status: { OK: 'OK' },
      AnalyzeType: { EXACT: 'EXACT' },
      Geocoder: vi.fn(function () { return { addressSearch } }),
    },
  } as unknown as KakaoMaps
  window.kakao = { maps }
  return { addressSearch, latLng, map }
}

beforeEach(() => {
  vi.stubEnv('VITE_KAKAO_MAP_JS_KEY', 'test-key')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.kakao
  document.getElementById('kakao-map-sdk')?.remove()
})

describe('shelter coordinate verification', () => {
  it('accepts only one detailed Korean address and keeps x/y in longitude/latitude order', () => {
    expect(verifiedShelterCoordinate([exactResult], 'OK', 'OK'))
      .toEqual({ latitude: 37.571, longitude: 126.889 })
    expect(verifiedShelterCoordinate([{ ...exactResult, address_type: 'REGION' }], 'OK', 'OK')).toBeNull()
    expect(verifiedShelterCoordinate([exactResult, exactResult], 'OK', 'OK')).toBeNull()
    expect(verifiedShelterCoordinate([], 'OK', 'OK')).toBeNull()
    expect(verifiedShelterCoordinate([exactResult], 'ZERO_RESULT', 'OK')).toBeNull()
    expect(verifiedShelterCoordinate([{ ...exactResult, y: '32.999' }], 'OK', 'OK')).toBeNull()
    expect(verifiedShelterCoordinate([{ ...exactResult, x: 'not-a-number' }], 'OK', 'OK')).toBeNull()
  })
})

describe('KakaoShelterMap', () => {
  it('defers geocoding until requested and renders one verified marker', async () => {
    const kakao = installKakao([exactResult])
    render(<KakaoShelterMap name="마포/보호소,본관" address=" 서울 마포구 매봉산로 31 " />)

    expect(kakao.addressSearch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '지도에서 위치 확인' }))

    const mapLink = await screen.findByRole('link', { name: '카카오맵에서 크게 보기' })
    expect(kakao.addressSearch).toHaveBeenCalledWith(
      '서울 마포구 매봉산로 31',
      expect.any(Function),
      { analyze_type: 'EXACT', size: 2 },
    )
    expect(kakao.latLng).toHaveBeenCalledWith(37.571, 126.889)
    expect(screen.getByRole('region', { name: '마포/보호소,본관 위치 지도' }).hasAttribute('hidden')).toBe(false)
    expect(mapLink.getAttribute('href')).toContain(encodeURIComponent('마포/보호소,본관'))
    expect(mapLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('rejects ambiguous results and keeps an encoded address-search fallback', async () => {
    installKakao([exactResult, exactResult])
    render(<KakaoShelterMap name="보호소" address="서울 마포구 31/2" />)
    fireEvent.click(screen.getByRole('button', { name: '지도에서 위치 확인' }))

    expect(await screen.findByText('정확한 위치를 확인하지 못했습니다.')).toBeTruthy()
    const link = screen.getByRole('link', { name: '카카오맵에서 주소 검색' })
    expect(link.getAttribute('href')).toContain(encodeURIComponent('서울 마포구 31/2'))
    expect(document.querySelector('.animal-dialog__shelter-map-canvas')?.hasAttribute('hidden')).toBe(true)
  })

  it('falls back when address search returns no result', async () => {
    installKakao([], 'ZERO_RESULT')
    render(<KakaoShelterMap name="보호소" address="서울 마포구 없는 주소" />)
    fireEvent.click(screen.getByRole('button', { name: '지도에서 위치 확인' }))

    expect(await screen.findByText('정확한 위치를 확인하지 못했습니다.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '카카오맵에서 주소 검색' })).toBeTruthy()
  })

  it('falls back when the SDK fails and allows a retry', async () => {
    delete window.kakao
    render(<KakaoShelterMap name="보호소" address="서울 마포구 매봉산로 31" />)
    fireEvent.click(screen.getByRole('button', { name: '지도에서 위치 확인' }))
    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement
    script.dispatchEvent(new Event('error'))

    expect(await screen.findByText('정확한 위치를 확인하지 못했습니다.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 위치 확인' })).toBeTruthy()
    expect(document.getElementById('kakao-map-sdk')).toBeNull()
  })

  it('shows only the search fallback when the map key is missing', () => {
    vi.stubEnv('VITE_KAKAO_MAP_JS_KEY', '')
    render(<KakaoShelterMap name="보호소" address="서울 마포구 매봉산로 31" />)

    expect(screen.getByText('지도 키가 설정되지 않아 주소 검색 링크를 제공합니다.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.getElementById('kakao-map-sdk')).toBeNull()
  })

  it('ignores an older callback after the address changes', async () => {
    const callbacks: Array<(results: KakaoAddressResult[], status: string) => void> = []
    const kakao = installKakao([])
    kakao.addressSearch.mockImplementation((
      _address: string,
      callback: (results: KakaoAddressResult[], status: string) => void,
    ) => { callbacks.push(callback) })
    const view = render(<KakaoShelterMap name="보호소" address="서울 마포구 매봉산로 31" />)
    fireEvent.click(screen.getByRole('button', { name: '지도에서 위치 확인' }))
    await waitFor(() => expect(kakao.addressSearch).toHaveBeenCalled())

    view.rerender(<KakaoShelterMap name="보호소" address="서울 마포구 월드컵로 1" />)
    await waitFor(() => expect(kakao.addressSearch).toHaveBeenCalledTimes(2))
    callbacks[0]([exactResult], 'OK')
    expect(kakao.latLng).not.toHaveBeenCalled()
    callbacks[1]([exactResult], 'OK')
    await waitFor(() => expect(kakao.latLng).toHaveBeenCalledWith(37.571, 126.889))
  })
})
