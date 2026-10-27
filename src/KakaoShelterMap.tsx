import { useEffect, useRef, useState } from 'react'
import {
  loadKakaoMaps,
  type KakaoAddressResult,
  type KakaoMaps,
} from './KakaoClinicMap'

type Coordinate = { latitude: number; longitude: number }

export function verifiedShelterCoordinate(
  results: KakaoAddressResult[],
  status: string,
  okStatus: string,
): Coordinate | null {
  if (status !== okStatus || results.length !== 1
      || !['ROAD_ADDR', 'REGION_ADDR'].includes(results[0].address_type)) return null
  const latitude = Number(results[0].y)
  const longitude = Number(results[0].x)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) return null
  return { latitude, longitude }
}

export default function KakaoShelterMap({ name, address }: { name: string; address: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY as string | undefined
  const cleanAddress = address.trim()

  useEffect(() => {
    if (!attempt || !key || !cleanAddress) return
    let active = true
    setCoordinate(null)
    setState('loading')
    void loadKakaoMaps(key).then((maps) => {
      if (!active || !maps.services?.Geocoder) return
      const geocoder = new maps.services.Geocoder()
      geocoder.addressSearch(cleanAddress, (results, status) => {
        if (!active) return
        const next = verifiedShelterCoordinate(results, status, maps.services.Status.OK)
        setCoordinate(next)
        if (!next) setState('failed')
      }, { analyze_type: maps.services.AnalyzeType.EXACT, size: 2 })
    }).catch(() => {
      if (active) setState('failed')
    })
    return () => { active = false }
  }, [attempt, cleanAddress, key])

  useEffect(() => {
    if (!coordinate || !container.current || !key) return
    let active = true
    let marker: InstanceType<KakaoMaps['Marker']> | null = null
    void loadKakaoMaps(key).then((maps) => {
      if (!active || !container.current) return
      const point = new maps.LatLng(coordinate.latitude, coordinate.longitude)
      const map = new maps.Map(container.current, { center: point, level: 4, scrollwheel: false })
      marker = new maps.Marker({ map, position: point })
      map.relayout()
      map.setCenter(point)
      setState('ready')
    }).catch(() => {
      if (active) setState('failed')
    })
    return () => {
      active = false
      marker?.setMap(null)
    }
  }, [coordinate, key])

  const searchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(cleanAddress)}`
  const mapUrl = coordinate
    ? `https://map.kakao.com/link/map/${encodeURIComponent(name)},${coordinate.latitude},${coordinate.longitude}`
    : ''
  const statusMessage = state === 'loading'
    ? '보호소 위치를 확인하는 중…'
    : state === 'failed'
      ? '정확한 위치를 확인하지 못했습니다.'
      : ''

  return <section className="animal-dialog__shelter-map" aria-label="보호소 위치">
    {!key
      ? <p role="status">지도 키가 설정되지 않아 주소 검색 링크를 제공합니다.</p>
      : <><p role="status">{statusMessage}</p>
        <button
          type="button"
          disabled={state === 'loading'}
          aria-busy={state === 'loading'}
          onClick={() => setAttempt((value) => value + 1)}
        >{state === 'idle' ? '지도에서 위치 확인' : state === 'loading' ? '위치 확인 중…' : '다시 위치 확인'}</button></>}
    <div
      ref={container}
      className="animal-dialog__shelter-map-canvas"
      role="region"
      aria-label={`${name} 위치 지도`}
      hidden={state !== 'ready'}
    />
    <a
      href={state === 'ready' ? mapUrl : searchUrl}
      target="_blank"
      rel="noopener noreferrer"
    >{state === 'ready' ? '카카오맵에서 크게 보기' : '카카오맵에서 주소 검색'}</a>
    <small>공공 데이터의 주소와 실제 보호 장소가 다를 수 있으니 방문 전 전화로 확인해 주세요.</small>
  </section>
}
