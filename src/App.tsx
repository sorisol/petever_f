import { useEffect, useState } from 'react'

type Animal = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  imageUrl: string | null
  listingType: string
}

type AnimalPage = {
  content: Animal[]
  number: number
  totalPages: number
  totalElements: number
}

type LoadState = {
  page: AnimalPage | null
  loading: boolean
  error: boolean
}

type Species = '' | 'DOG' | 'CAT'

const initialState: LoadState = { page: null, loading: true, error: false }
const statusLabels: Record<string, string> = {
  PROTECTED: '보호 중',
  ADOPTED: '입양 완료',
  RETURNED: '반환',
  TRANSFERRED: '이관',
  DECEASED: '사망',
  OTHER_CLOSED: '종료',
  UNKNOWN: '상태 미상',
}

async function getAnimals(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Animal request failed')
  return response.json() as Promise<AnimalPage>
}

function text(value: string | null, fallback: string) {
  return value?.trim() || fallback
}

function AnimalImage({ animal }: { animal: Animal }) {
  const [failed, setFailed] = useState(false)
  const name = text(animal.name, '이름 미상')

  if (!animal.imageUrl || failed) {
    return (
      <div className="animal-image fallback" role="img" aria-label={`${name} 사진 없음`}>
        <span>사진 없음</span>
      </div>
    )
  }

  return (
    <img
      className="animal-image"
      src={animal.imageUrl}
      alt={`${name} 사진`}
      onError={() => setFailed(true)}
    />
  )
}

function SectionState({
  loading,
  error,
  empty,
  emptyMessage,
  errorMessage,
}: {
  loading: boolean
  error: boolean
  empty: boolean
  emptyMessage: string
  errorMessage: string
}) {
  if (loading) return <p className="section-state">불러오는 중…</p>
  if (error) return <p className="section-state error">{errorMessage}</p>
  if (empty) return <p className="section-state">{emptyMessage}</p>
  return null
}

export default function App() {
  const [species, setSpecies] = useState<Species>('')
  const [retryVersion, setRetryVersion] = useState(0)
  const [shelter, setShelter] = useState<LoadState>(initialState)
  const [lost, setLost] = useState<LoadState>(initialState)

  useEffect(() => {
    const controller = new AbortController()
    const speciesQuery = species ? `&species=${species}` : ''
    setShelter({ page: null, loading: true, error: false })

    void getAnimals(
      `/api/animals?listing_type=SHELTER_ANIMAL&size=8${speciesQuery}`,
      controller.signal,
    )
      .then((page) => {
        if (!controller.signal.aborted) setShelter({ page, loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setShelter((current) => ({ ...current, loading: false, error: true }))
        }
      })

    return () => controller.abort()
  }, [species, retryVersion])

  useEffect(() => {
    const controller = new AbortController()
    setLost((current) => ({ ...current, loading: true, error: false }))

    void getAnimals('/api/animals?listing_type=LOST_REPORT&size=8', controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setLost({ page, loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLost((current) => ({ ...current, loading: false, error: true }))
        }
      })

    return () => controller.abort()
  }, [retryVersion])

  const speciesLabel = species === 'DOG' ? '강아지' : species === 'CAT' ? '고양이' : '전체'
  const shelterAnimals = shelter.page?.content ?? []
  const lostAnimals = lost.page?.content ?? []

  return (
    <>
      <a className="skip-link" href="#main">본문으로 건너뛰기</a>
      <header className="dash-head">
        <a className="wordmark" href="#main" aria-label="Petever 홈">
          <span className="wordmark-mark">P</span>Petever
        </a>
        <nav className="dash-nav" aria-label="주요 메뉴">
          <a className="active" href="#main">홈</a>
          <a href="#rescue">구조동물</a>
          <a href="#lost">분실동물</a>
        </nav>
      </header>

      <main className="dash-main" id="main">
        <section className="dash-intro">
          <div>
            <span className="overline" lang="en">Every life, ever loved</span>
            <h1>다시 만나는 날까지,<br />곁을 지켜요.</h1>
          </div>
          <p>보호 중인 동물에게는 새로운 가족을, 길을 잃은 동물에게는 돌아갈 길을 연결합니다.</p>
        </section>

        <section className="summary-bar" aria-label="동물 현황">
          <div className="summary-item summary-lead">
            <span className="label">실시간 공고 현황</span>
            <strong>Petever</strong>
          </div>
          <div className="summary-item">
            <span className="label">{speciesLabel} 구조동물</span>
            <strong>{shelter.page?.totalElements ?? '—'}</strong>
          </div>
          <div className="summary-item">
            <span className="label">분실동물</span>
            <strong className="lost-count">{lost.page?.totalElements ?? '—'}</strong>
          </div>
        </section>

        {(shelter.error || lost.error) && (
          <div className="retry-banner" role="alert">
            <span>일부 정보를 불러오지 못했습니다.</span>
            <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>
              다시 시도
            </button>
          </div>
        )}

        <section className="dash-section" id="rescue">
          <div className="dash-section-head">
            <div className="dash-title-row">
              <span className="dash-icon" aria-hidden="true">⌂</span>
              <div><h2>구조동물</h2><p>새로운 가족을 기다리는 동물이에요</p></div>
            </div>
            <div className="filter-row" aria-label="구조동물 종류">
              {([
                ['', '전체'],
                ['DOG', '강아지'],
                ['CAT', '고양이'],
              ] as const).map(([value, label]) => (
                <button
                  className={`filter-chip ${species === value ? 'active' : ''}`}
                  key={label}
                  type="button"
                  aria-pressed={species === value}
                  onClick={() => setSpecies(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <SectionState
            loading={shelter.loading}
            error={shelter.error}
            empty={!shelterAnimals.length}
            emptyMessage="조건에 맞는 구조동물이 없습니다."
            errorMessage="구조동물을 불러오지 못했습니다."
          />
          {!shelter.loading && !shelter.error && shelterAnimals.length > 0 && (
            <div className="dash-grid">
              {shelterAnimals.map((animal) => {
                const name = text(animal.name, '이름 미상')
                const breed = text(animal.breedName, '품종 미상')
                return (
                  <article className="dash-card" key={animal.id}>
                    <div className="dash-card-photo">
                      <AnimalImage animal={animal} />
                      <span className="status">
                        {statusLabels[animal.careStatus] ?? '상태 미상'}
                      </span>
                    </div>
                    <div className="dash-card-copy">
                      <h3>{name} · {breed}</h3>
                      <p>
                        {animal.species === 'DOG'
                          ? '강아지'
                          : animal.species === 'CAT'
                            ? '고양이'
                            : '기타 동물'}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="dash-section lost-dash" id="lost">
          <div className="dash-section-head">
            <div className="dash-title-row">
              <span className="dash-icon" aria-hidden="true">!</span>
              <div><h2>분실동물</h2><p>최근 등록된 분실 신고를 확인해 주세요</p></div>
            </div>
          </div>

          <SectionState
            loading={lost.loading}
            error={lost.error}
            empty={!lostAnimals.length}
            emptyMessage="등록된 분실동물이 없습니다."
            errorMessage="분실동물을 불러오지 못했습니다."
          />
          {!lost.error && lostAnimals.length > 0 && (
            <div className="lost-table">
              {lostAnimals.map((animal) => {
                const name = text(animal.name, '이름 미상')
                return (
                  <article className="lost-row" key={animal.id}>
                    <AnimalImage animal={animal} />
                    <div>
                      <strong>{name}</strong>
                      <small>{text(animal.breedName, '품종 미상')}</small>
                    </div>
                    <span className="urgent">분실 신고</span>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
