import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadKakaoMaps, type KakaoMaps } from './KakaoClinicMap'

function readyKakao() {
  const maps = {
    load: (callback: () => void) => callback(),
    LatLng: vi.fn(),
    LatLngBounds: vi.fn(),
    Map: vi.fn(),
    Marker: vi.fn(),
    services: {
      Status: { OK: 'OK' },
      AnalyzeType: { EXACT: 'EXACT' },
      Geocoder: vi.fn(),
    },
  } as unknown as KakaoMaps
  window.kakao = { maps }
  return maps
}

afterEach(() => {
  delete window.kakao
  document.getElementById('kakao-map-sdk')?.remove()
})

describe('Kakao map SDK loader', () => {
  it('shares an in-flight load and waits for maps plus services', async () => {
    const first = loadKakaoMaps('key')
    const second = loadKakaoMaps('key')
    expect(first).toBe(second)
    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement
    expect(script.src).toContain('libraries=services')

    const maps = readyKakao()
    script.dispatchEvent(new Event('load'))

    await expect(first).resolves.toBe(maps)
  })

  it('removes a failed script so a later call can retry', async () => {
    const first = loadKakaoMaps('key')
    const failedScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement
    failedScript.dispatchEvent(new Event('error'))
    await expect(first).rejects.toThrow('Kakao map load failed')
    expect(document.getElementById('kakao-map-sdk')).toBeNull()

    const retry = loadKakaoMaps('key')
    const retryScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement
    expect(retryScript).not.toBe(failedScript)
    const maps = readyKakao()
    retryScript.dispatchEvent(new Event('load'))
    await expect(retry).resolves.toBe(maps)
  })
})
