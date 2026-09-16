import { useEffect, useState } from 'react'

type AnimalSummary = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  listingType: "LOST_REPORT" | "SHELTER_ANIMAL"
  imageUrl: string | null
}
type AnimalDetail = AnimalSummary & {
  sex?: string
  ageDescription?: string | null
  foundPlace?: string | null
  description?: string | null
  shelterName?: string | null
  shelterPhone?: string | null
  images: string[]
}
type AnimalPage = { content: AnimalSummary[]; number: number; totalPages: number }

const statusNames: Record<string, string> = {
  PROTECTED: '보호 중', ADOPTED: '입양 완료', RETURNED: '반환',
  TRANSFERRED: '이관', DECEASED: '사망', OTHER_CLOSED: '종료', UNKNOWN: '상태 미확인',
}
const speciesNames: Record<string, string> = { DOG: '강아지', CAT: '고양이', OTHER: '기타', UNKNOWN: '미확인' }

function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const changed = () => setPath(window.location.pathname)
    window.addEventListener('popstate', changed)
    return () => window.removeEventListener('popstate', changed)
  }, [])
  const navigate = (to: string) => { window.history.pushState({}, '', to); setPath(to) }
  return [path, navigate] as const
}

function AnimalPhoto({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <div className={className}>{src && !failed
    ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : <span>🐾</span>}</div>
}

function AnimalList({ navigate }: { navigate: (to: string) => void }) {
  const [species, setSpecies] = useState('')
  const [careStatus, setCareStatus] = useState('')
  const [listingType, setListingType] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<AnimalPage | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), size: '12' })
    if (species) params.set('species', species)
    if (careStatus) params.set('care_status', careStatus)
    if (listingType) params.set('listing_type', listingType)
    setData(null)
    setError('')
    fetch('/api/animals?' + params, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('조회 실패'); return response.json() })
      .then(setData)
      .catch(err => { if (err.name !== 'AbortError') setError('동물 목록을 불러오지 못했습니다.') })
    return () => controller.abort()
  }, [species, careStatus, listingType, page])
  return <main className="shell">
    <header><a href="/" onClick={e => { e.preventDefault(); navigate('/') }} className="brand">Petever</a><span>동물 소식을 확인하세요</span></header>
    <section className="intro"><p className="eyebrow">보호·분실 동물 소식</p><h1>동물 소식 둘러보기</h1><p>보호 동물과 분실 신고를 구분해 확인해 보세요.</p></section>
    <div className="filters">
      <label>동물 종류 <select value={species} onChange={e => { setSpecies(e.target.value); setPage(0) }}><option value="">전체</option><option value="DOG">강아지</option><option value="CAT">고양이</option><option value="OTHER">기타</option></select></label>
      <label>게시 유형 <select value={listingType} onChange={e => { setListingType(e.target.value); setPage(0) }}><option value="">전체</option><option value="LOST_REPORT">분실 신고</option><option value="SHELTER_ANIMAL">보호 동물</option></select></label>
      <label>보호 상태 <select value={careStatus} onChange={e => { setCareStatus(e.target.value); setPage(0) }}><option value="">전체</option><option value="PROTECTED">보호 중</option><option value="ADOPTED">입양 완료</option><option value="RETURNED">반환</option></select></label>
    </div>
    {error && <p role="alert" className="message">{error}</p>}
    {!data && !error && <p className="message">동물을 불러오는 중입니다…</p>}
    {data?.content.length === 0 && <p className="message">조건에 맞는 동물이 없습니다.</p>}
    {data && <div className="cards">{data.content.map(animal => <a href={'/animals/' + animal.id} onClick={e => { e.preventDefault(); navigate('/animals/' + animal.id) }} className="card" key={animal.id}>
      <AnimalPhoto src={animal.imageUrl} alt={animal.name || animal.breedName || '동물'} className="photo" />
      <div className="cardBody"><span className="tag">{animal.listingType === 'LOST_REPORT' ? '분실 신고' : statusNames[animal.careStatus] || '상태 미확인'}</span><h2>{animal.name || animal.breedName || '이름을 기다리는 동물'}</h2><p>{speciesNames[animal.species] || '동물'} · {animal.breedName || '품종 미확인'}</p></div>
    </a>)}</div>}
    {data && data.totalPages > 1 && <nav className="pagination" aria-label="페이지 이동"><button disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{data.number + 1} / {data.totalPages}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>다음</button></nav>}
  </main>
}

function AnimalDetailPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [animal, setAnimal] = useState<AnimalDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/animals/' + id, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('조회 실패'); return response.json() })
      .then(setAnimal)
      .catch(err => { if (err.name !== 'AbortError') setError('동물 정보를 찾을 수 없습니다.') })
    return () => controller.abort()
  }, [id])
  return <main className="shell">
    <header><a href="/animals" onClick={e => { e.preventDefault(); navigate('/animals') }} className="brand">Petever</a><span>동물 소식</span></header>
    <a href="/animals" onClick={e => { e.preventDefault(); navigate('/animals') }} className="back">← 목록으로</a>
    {error && <p role="alert" className="message">{error}</p>}
    {!animal && !error && <p className="message">동물 정보를 불러오는 중입니다…</p>}
    {animal && <article className="detail"><AnimalPhoto src={animal.images?.[0] ?? null} alt={animal.name || '보호 동물'} className="detailPhoto" /><div className="detailBody">
      <span className="tag">{animal.listingType === 'LOST_REPORT' ? '분실 신고' : statusNames[animal.careStatus] || '상태 미확인'}</span><h1>{animal.name || animal.breedName || '이름을 기다리는 동물'}</h1>
      <dl><div><dt>종류</dt><dd>{speciesNames[animal.species] || '미확인'}</dd></div><div><dt>품종</dt><dd>{animal.breedName || '미확인'}</dd></div><div><dt>성별</dt><dd>{animal.sex === 'MALE' ? '수컷' : animal.sex === 'FEMALE' ? '암컷' : '미확인'}</dd></div><div><dt>나이</dt><dd>{animal.ageDescription || '미확인'}</dd></div><div><dt>{animal.listingType === 'LOST_REPORT' ? '분실 지역' : '발견 장소'}</dt><dd>{animal.foundPlace || '미확인'}</dd></div></dl>
      {animal.description && <p className="description">{animal.description}</p>}
      {animal.listingType !== 'LOST_REPORT' && <div className="shelter"><strong>{animal.shelterName || '보호소'}</strong>{animal.shelterPhone && <a href={'tel:' + animal.shelterPhone}>{animal.shelterPhone}</a>}</div>}
    </div></article>}
  </main>
}

export default function App() {
  const [path, navigate] = usePath()
  const match = path.match(/^\/animals\/(\d+)\/?$/)
  if (match) return <AnimalDetailPage id={match[1]} navigate={navigate} />
  if (path === '/animals' || path === '/animals/') return <AnimalList navigate={navigate} />
  return <main className="home"><h1>Petever</h1><p>프로젝트가 실행 중입니다.</p><a href="/animals" onClick={e => { e.preventDefault(); navigate('/animals') }}>동물 소식 둘러보기</a></main>
}
