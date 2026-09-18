import { useEffect, useState } from 'react'
import './animal-browser.css'

type AnimalSummary = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  listingType: 'LOST_REPORT' | 'SHELTER_ANIMAL'
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
const speciesNames: Record<string, string> = {
  DOG: '강아지', CAT: '고양이', OTHER: '기타', UNKNOWN: '미확인',
}

function AnimalPhoto({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return (
    <div className={className}>
      {src && !failed
        ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <span>🐾</span>}
    </div>
  )
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
      .then((response) => {
        if (!response.ok) throw new Error('조회 실패')
        return response.json() as Promise<AnimalPage>
      })
      .then(setData)
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') setError('동물 목록을 불러오지 못했습니다.')
      })
    return () => controller.abort()
  }, [species, careStatus, listingType, page])

  return <AnimalListView
    navigate={navigate}
    filters={{ species, careStatus, listingType }}
    setFilters={{ setSpecies, setCareStatus, setListingType }}
    page={page}
    setPage={setPage}
    data={data}
    error={error}
  />
}

type AnimalListViewProps = {
  navigate: (to: string) => void
  filters: { species: string; careStatus: string; listingType: string }
  setFilters: {
    setSpecies: (value: string) => void
    setCareStatus: (value: string) => void
    setListingType: (value: string) => void
  }
  page: number
  setPage: (value: number) => void
  data: AnimalPage | null
  error: string
}

function AnimalListView({
  navigate,
  filters,
  setFilters,
  page,
  setPage,
  data,
  error,
}: AnimalListViewProps) {
  const change = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(0)
  }

  return (
    <main className="animal-shell">
      <header className="animal-header">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate('/') }} className="animal-brand">Petever</a>
        <span>동물 소식을 확인하세요</span>
      </header>
      <section className="animal-intro">
        <p className="animal-eyebrow">보호·분실 동물 소식</p>
        <h1>동물 소식 둘러보기</h1>
        <p>보호 동물과 분실 신고를 구분해 확인해 보세요.</p>
      </section>
      <div className="animal-filters">
        <label>동물 종류 <select value={filters.species} onChange={(event) => change(setFilters.setSpecies, event.target.value)}><option value="">전체</option><option value="DOG">강아지</option><option value="CAT">고양이</option><option value="OTHER">기타</option></select></label>
        <label>게시 유형 <select value={filters.listingType} onChange={(event) => change(setFilters.setListingType, event.target.value)}><option value="">전체</option><option value="LOST_REPORT">분실 신고</option><option value="SHELTER_ANIMAL">보호 동물</option></select></label>
        <label>보호 상태 <select value={filters.careStatus} onChange={(event) => change(setFilters.setCareStatus, event.target.value)}><option value="">전체</option><option value="PROTECTED">보호 중</option><option value="ADOPTED">입양 완료</option><option value="RETURNED">반환</option></select></label>
      </div>
      {error && <p role="alert" className="animal-message">{error}</p>}
      {!data && !error && <p className="animal-message">동물을 불러오는 중입니다…</p>}
      {data?.content.length === 0 && <p className="animal-message">조건에 맞는 동물이 없습니다.</p>}
      {data && <AnimalCards animals={data.content} navigate={navigate} />}
      {data && data.totalPages > 1 && <nav className="animal-pagination" aria-label="페이지 이동">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
        <span>{data.number + 1} / {data.totalPages}</span>
        <button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>다음</button>
      </nav>}
    </main>
  )
}

function AnimalCards({
  animals,
  navigate,
}: {
  animals: AnimalSummary[]
  navigate: (to: string) => void
}) {
  return (
    <div className="animal-cards">
      {animals.map((animal) => (
        <a
          href={'/animals/' + animal.id}
          onClick={(event) => { event.preventDefault(); navigate('/animals/' + animal.id) }}
          className="animal-card"
          key={animal.id}
        >
          <AnimalPhoto
            src={animal.imageUrl}
            alt={animal.name || animal.breedName || '동물'}
            className="animal-photo"
          />
          <div className="animal-card-body">
            <span className="animal-tag">
              {animal.listingType === 'LOST_REPORT'
                ? '분실 신고'
                : statusNames[animal.careStatus] || '상태 미확인'}
            </span>
            <h2>{animal.name || animal.breedName || '이름을 기다리는 동물'}</h2>
            <p>{speciesNames[animal.species] || '동물'} · {animal.breedName || '품종 미확인'}</p>
          </div>
        </a>
      ))}
    </div>
  )
}

function AnimalDetailPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [animal, setAnimal] = useState<AnimalDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/animals/' + id, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('조회 실패')
        return response.json() as Promise<AnimalDetail>
      })
      .then(setAnimal)
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') setError('동물 정보를 찾을 수 없습니다.')
      })
    return () => controller.abort()
  }, [id])

  return (
    <main className="animal-shell">
      <header className="animal-header">
        <a
          href="/animals"
          onClick={(event) => { event.preventDefault(); navigate('/animals') }}
          className="animal-brand"
        >
          Petever
        </a>
        <span>동물 소식</span>
      </header>
      <a
        href="/animals"
        onClick={(event) => { event.preventDefault(); navigate('/animals') }}
        className="animal-back"
      >
        ← 목록으로
      </a>
      {error && <p role="alert" className="animal-message">{error}</p>}
      {!animal && !error && <p className="animal-message">동물 정보를 불러오는 중입니다…</p>}
      {animal && <AnimalDetailView animal={animal} />}
    </main>
  )
}

function AnimalDetailView({ animal }: { animal: AnimalDetail }) {
  return (
    <article className="animal-detail">
      <AnimalPhoto
        src={animal.images?.[0] ?? null}
        alt={animal.name || '보호 동물'}
        className="animal-detail-photo"
      />
      <div className="animal-detail-body">
        <span className="animal-tag">
          {animal.listingType === 'LOST_REPORT'
            ? '분실 신고'
            : statusNames[animal.careStatus] || '상태 미확인'}
        </span>
        <h1>{animal.name || animal.breedName || '이름을 기다리는 동물'}</h1>
        <dl>
          <div><dt>종류</dt><dd>{speciesNames[animal.species] || '미확인'}</dd></div>
          <div><dt>품종</dt><dd>{animal.breedName || '미확인'}</dd></div>
          <div><dt>성별</dt><dd>{animal.sex === 'MALE' ? '수컷' : animal.sex === 'FEMALE' ? '암컷' : '미확인'}</dd></div>
          <div><dt>나이</dt><dd>{animal.ageDescription || '미확인'}</dd></div>
          <div><dt>{animal.listingType === 'LOST_REPORT' ? '분실 지역' : '발견 장소'}</dt><dd>{animal.foundPlace || '미확인'}</dd></div>
        </dl>
        {animal.description && <p className="animal-description">{animal.description}</p>}
        {animal.listingType !== 'LOST_REPORT' && <div className="animal-shelter">
          <strong>{animal.shelterName || '보호소'}</strong>
          {animal.shelterPhone && <a href={'tel:' + animal.shelterPhone}>{animal.shelterPhone}</a>}
        </div>}
      </div>
    </article>
  )
}

export default function AnimalBrowser({
  path,
  navigate,
}: {
  path: string
  navigate: (to: string) => void
}) {
  const match = path.match(/^\/animals\/(\d+)\/?$/)
  if (match) return <AnimalDetailPage id={match[1]} navigate={navigate} />
  return <AnimalList navigate={navigate} />
}
