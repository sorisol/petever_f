import { useEffect, useRef, useState } from 'react'

export type MapClinic = {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
}

type KakaoMaps = {
  load: (callback: () => void) => void
  LatLng: new (latitude: number, longitude: number) => unknown
  LatLngBounds: new () => { extend: (point: unknown) => void }
  Map: new (container: HTMLElement, options: object) => {
    setBounds: (bounds: unknown) => void
    relayout: () => void
  }
  Marker: new (options: object) => { setMap: (map: unknown) => void }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

let kakaoPromise: Promise<KakaoMaps> | null = null

export function loadKakaoMaps(key: string) {
  if (window.kakao?.maps) return Promise.resolve(window.kakao.maps)
  if (kakaoPromise) return kakaoPromise
  kakaoPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const existing = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    const timeout = window.setTimeout(() => reject(new Error('Kakao map load timeout')), 10_000)
    const finish = () => {
      if (!window.kakao?.maps) {
        window.clearTimeout(timeout)
        reject(new Error('Kakao map SDK unavailable'))
        return
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timeout)
        resolve(window.kakao!.maps)
      })
    }
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => {
      window.clearTimeout(timeout)
      reject(new Error('Kakao map load failed'))
    }, { once: true })
    if (!existing) {
      script.id = 'kakao-map-sdk'
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
      document.head.append(script)
    }
  }).catch((error) => {
    kakaoPromise = null
    throw error
  })
  return kakaoPromise
}

export default function KakaoClinicMap({
  clinics,
  userLocation,
  expanded,
}: {
  clinics: MapClinic[]
  userLocation: { lat: number; lng: number } | null
  expanded: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<InstanceType<KakaoMaps['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<KakaoMaps['Marker']>>>([])
  const [error, setError] = useState('')
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY as string | undefined

  useEffect(() => {
    if (!expanded || !container.current || !key) return
    let active = true
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []
    void loadKakaoMaps(key).then((maps) => {
      if (!active || !container.current) return
      const points = clinics
        .filter((clinic) => clinic.latitude != null && clinic.longitude != null)
        .map((clinic) => new maps.LatLng(clinic.latitude!, clinic.longitude!))
      if (userLocation) points.push(new maps.LatLng(userLocation.lat, userLocation.lng))
      const center = points[0] ?? new maps.LatLng(37.5665, 126.978)
      const map = mapRef.current ?? new maps.Map(container.current, { center, level: 7 })
      mapRef.current = map
      map.relayout()
      const bounds = new maps.LatLngBounds()
      markersRef.current = points.map((point) => {
        bounds.extend(point)
        return new maps.Marker({ map, position: point })
      })
      if (points.length) map.setBounds(bounds)
      setError('')
    }).catch(() => {
      if (active) setError('지도를 불러오지 못했습니다. 병원 목록은 계속 이용할 수 있어요.')
    })
    return () => {
      active = false
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [clinics, expanded, key, userLocation])

  if (!key) return <p className="clinic-map-message">지도 키가 설정되지 않았습니다. 병원 목록은 계속 이용할 수 있어요.</p>
  if (!expanded) return null
  return (
    <>
      {error && <p className="clinic-map-message" role="status">{error}</p>}
      <div ref={container} className="clinic-map-canvas" role="img" aria-label="조회된 동물병원 위치 지도" />
    </>
  )
}
