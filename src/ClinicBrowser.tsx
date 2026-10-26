import { useEffect, useRef, useState } from 'react'
import KakaoClinicMap, { type MapClinic } from './KakaoClinicMap'
import './clinic-browser.css'

type Region = { sido: string; sigungus: string[] }
type Clinic = MapClinic & {
  address: string
  phone: string | null
  sido: string | null
  sigungu: string | null
  operatingStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN'
  lastVerifiedAt: string | null
  distanceMeters?: number
}
type ClinicPage = { content: Clinic[]; number: number; totalPages: number; totalElements: number }
type NearbyPage = {
  content: Clinic[]
  count: number
  truncated: boolean
  radiusKm: number
}

const statusText = { OPEN: '영업 중', CLOSED: '휴·폐업', UNKNOWN: '상태 미상' }
const EMPTY_CLINICS: Clinic[] = []

async function json<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error('Clinic request failed')
  return response.json() as Promise<T>
}

function phoneHref(phone: string | null) {
  return phone && /^[0-9\s()+-]+$/.test(phone) ? `tel:${phone.replace(/\s/g, '')}` : null
}

export default function ClinicBrowser({ navigate }: { navigate: (to: string) => void }) {
  const [regions, setRegions] = useState<Region[]>([])
  const [regionError, setRegionError] = useState(false)
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [status, setStatus] = useState<'OPEN' | 'CLOSED' | 'UNKNOWN'>('OPEN')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ClinicPage | null>(null)
  const [nearby, setNearby] = useState<NearbyPage | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mapExpanded, setMapExpanded] = useState(
    () => !(window.matchMedia?.('(max-width: 640px)').matches ?? false),
  )
  const nearbyRequest = useRef<AbortController | null>(null)

  useEffect(() => () => nearbyRequest.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    void json<Region[]>('/api/veterinary-clinics/regions', { signal: controller.signal })
      .then(setRegions)
      .catch(() => { if (!controller.signal.aborted) setRegionError(true) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!sido || nearby) return
    const controller = new AbortController()
    const params = new URLSearchParams({ sido, status, page: String(page), size: '12' })
    if (sigungu) params.set('sigungu', sigungu)
    setLoading(true)
    setError('')
    void json<ClinicPage>(`/api/veterinary-clinics?${params}`, { signal: controller.signal })
      .then((data) => { setResult(data); setLoading(false) })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult(null)
          setLoading(false)
          setError('병원 목록을 불러오지 못했습니다.')
        }
      })
    return () => controller.abort()
  }, [nearby, page, sido, sigungu, status])

  const findNearby = () => {
    setError('')
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 찾기를 지원하지 않습니다. 지역별 검색을 이용해 주세요.')
      return
    }
    nearbyRequest.current?.abort()
    const controller = new AbortController()
    nearbyRequest.current = controller
    setLoading(true)
    navigator.geolocation.getCurrentPosition((position) => {
      const location = {
        lat: Number(position.coords.latitude.toFixed(3)),
        lng: Number(position.coords.longitude.toFixed(3)),
      }
      void json<NearbyPage>('/api/veterinary-clinics/nearby-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...location, radiusKm: 5, limit: 20, status: 'OPEN' }),
        signal: controller.signal,
      }).then((data) => {
        if (controller.signal.aborted) return
        setUserLocation(location)
        setNearby(data)
        setLoading(false)
      }).catch(() => {
        if (controller.signal.aborted) return
        setLoading(false)
        setError('내 주변 병원을 불러오지 못했습니다. 지역별 검색을 이용해 주세요.')
      })
    }, () => {
      setLoading(false)
      setError('위치 권한을 확인하지 못했습니다. 지역별 검색을 이용해 주세요.')
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 })
  }

  const clinics = nearby?.content ?? result?.content ?? EMPTY_CLINICS
  const selectedRegion = regions.find((region) => region.sido === sido)
  const showRegionMode = () => {
    nearbyRequest.current?.abort()
    setNearby(null)
    setUserLocation(null)
    setError('')
  }

  return (
    <div className="clinic-page">
      <header className="clinic-head">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate('/') }} className="wordmark">
          <span className="wordmark-mark">P</span>Petever
        </a>
        <button type="button" className="clinic-home" onClick={() => navigate('/')}>홈으로</button>
      </header>
      <main className="clinic-main">
        <div className="clinic-title">
          <span className="overline">VETERINARY CLINICS</span>
          <h1>가까운 동물병원을 찾아보세요</h1>
          <p>공식 인허가 정보를 기준으로 지역별 병원과 현재 위치에서 가까운 병원을 안내합니다.</p>
        </div>

        <section className="clinic-search" aria-labelledby="clinic-search-title">
          <div>
            <h2 id="clinic-search-title">병원 찾기</h2>
            <p>위치는 버튼을 누른 뒤에만 요청합니다. 지도 표시 시 대략적 위치가 Kakao에 전달될 수 있습니다.</p>
          </div>
          <div className="clinic-actions">
            <button type="button" className="nearby-button" onClick={findNearby}>내 주변 병원 찾기</button>
            {nearby && <button type="button" className="plain-button" onClick={showRegionMode}>지역별 찾기</button>}
          </div>
          {!nearby && <div className="clinic-filters">
            <label>시도
              <select value={sido} onChange={(event) => {
                setSido(event.target.value); setSigungu(''); setPage(0); setResult(null); setLoading(false)
              }}>
                <option value="">지역을 선택해 주세요</option>
                {regions.map((region) => <option key={region.sido}>{region.sido}</option>)}
              </select>
            </label>
            <label>시군구
              <select value={sigungu} disabled={!sido} onChange={(event) => { setSigungu(event.target.value); setPage(0) }}>
                <option value="">전체</option>
                {selectedRegion?.sigungus.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>인허가 상태
              <select value={status} onChange={(event) => {
                setStatus(event.target.value as typeof status); setPage(0)
              }}>
                <option value="OPEN">영업 중</option>
                <option value="CLOSED">휴·폐업</option>
                <option value="UNKNOWN">상태 미상</option>
              </select>
            </label>
          </div>}
          {regionError && <p role="alert">지역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
          {error && <p role="alert">{error}</p>}
        </section>

        <section className="clinic-results" aria-live="polite">
          <div className="clinic-result-head">
            <div>
              <h2>{nearby ? '내 주변 영업 중 병원' : '지역별 병원'}</h2>
              <p>{nearby
                ? `반경 ${nearby.radiusKm}km · 가까운 순 ${nearby.count}곳`
                : result ? `총 ${result.totalElements.toLocaleString()}곳` : '지역을 선택하면 병원을 보여드려요.'}</p>
            </div>
            <button type="button" className="plain-button" aria-expanded={mapExpanded}
              onClick={() => setMapExpanded((value) => !value)}>
              {mapExpanded ? '지도 접기' : '지도 펼치기'}
            </button>
          </div>
          {mapExpanded && <KakaoClinicMap clinics={clinics} userLocation={userLocation} expanded={mapExpanded} />}
          {loading && <p className="clinic-state">병원 정보를 불러오는 중…</p>}
          {!loading && !error && (sido || nearby) && clinics.length === 0 &&
            <p className="clinic-state">조건에 맞는 병원이 없습니다. 좌표가 없는 병원은 내 주변 결과에 포함되지 않습니다.</p>}
          <div className="clinic-list">
            {clinics.map((clinic) => {
              const href = phoneHref(clinic.phone)
              return <article className="clinic-card" key={clinic.id}>
                <div>
                  <span className={`clinic-status ${clinic.operatingStatus.toLowerCase()}`}>
                    {statusText[clinic.operatingStatus]}
                  </span>
                  {clinic.distanceMeters != null && <strong>{clinic.distanceMeters < 1000
                    ? `${clinic.distanceMeters}m`
                    : `${(clinic.distanceMeters / 1000).toFixed(1)}km`}</strong>}
                </div>
                <h3>{clinic.name}</h3>
                <p>{clinic.address}</p>
                {href ? <a href={href}>{clinic.phone}</a> : <span>{clinic.phone || '전화번호 정보 없음'}</span>}
              </article>
            })}
          </div>
          {!nearby && result && result.totalPages > 1 && <nav className="clinic-pagination" aria-label="병원 페이지 이동">
            <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>이전</button>
            <span>{page + 1} / {result.totalPages}</span>
            <button type="button" disabled={page + 1 >= result.totalPages} onClick={() => setPage((value) => value + 1)}>다음</button>
          </nav>}
          {nearby?.truncated && <p className="clinic-note">가까운 20곳만 표시했습니다.</p>}
        </section>
        <p className="clinic-caution">인허가상 영업 중은 현재 진료 중이라는 뜻이 아닙니다. 방문 전 병원에 운영 여부를 확인해 주세요.</p>
      </main>
    </div>
  )
}
