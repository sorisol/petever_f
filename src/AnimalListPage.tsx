import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AnimalDetailModal, { type AnimalModalSummary } from './AnimalDetailModal'

export type AnimalListNavigate = (to: string, options?: { replace?: boolean }) => void
type AnimalSummary = AnimalModalSummary & { listingType: 'LOST_REPORT' | 'SHELTER_ANIMAL' }
type AnimalPage = { content: AnimalSummary[]; number: number; totalPages: number; totalElements: number }
type Tab = 'lost' | 'rescue'
type ListState = {
  tab: Tab
  species: '' | 'DOG' | 'CAT' | 'OTHER'
  careStatus: '' | 'PROTECTED' | 'ADOPTED' | 'RETURNED' | 'TRANSFERRED' | 'DECEASED' | 'OTHER_CLOSED' | 'UNKNOWN'
  page: number
}

const PAGE_SIZE = 20
const MAX_PAGE = Math.floor(2_147_483_647 / PAGE_SIZE) + 1
const speciesNames: Record<string, string> = {
  DOG: '강아지', CAT: '고양이', OTHER: '기타', UNKNOWN: '미확인',
}
const statusNames: Record<string, string> = {
  PROTECTED: '보호 중', ADOPTED: '입양 완료', RETURNED: '반환', TRANSFERRED: '이관',
  DECEASED: '사망', OTHER_CLOSED: '종료', UNKNOWN: '상태 미상',
}
const speciesOptions = [
  ['', '전체'], ['DOG', '강아지'], ['CAT', '고양이'], ['OTHER', '기타'],
] as const
const careStatusOptions = [['', '전체'], ...Object.entries(statusNames)] as const
const allowedSpecies = new Set<string>(speciesOptions.map(([value]) => value).filter(Boolean))
const allowedCareStatuses = new Set(Object.keys(statusNames))

export function isPlainLeftClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function parsePage(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1
}

function serialize(state: ListState) {
  const params = new URLSearchParams()
  params.set('tab', state.tab)
  if (state.species) params.set('species', state.species)
  if (state.tab === 'rescue' && state.careStatus) params.set('care_status', state.careStatus)
  if (state.page > 1) params.set('page', String(state.page))
  return '?' + params.toString()
}

function parse(search: string) {
  const params = new URLSearchParams(search)
  const rawTab = params.get('tab')
  const legacy = params.get('listing_type')
  const tab: Tab = rawTab === 'lost' || rawTab === 'rescue'
    ? rawTab : legacy === 'SHELTER_ANIMAL' ? 'rescue' : 'lost'
  const rawSpecies = params.get('species') ?? ''
  const species = allowedSpecies.has(rawSpecies) ? rawSpecies as ListState['species'] : ''
  const rawCareStatus = params.get('care_status') ?? ''
  const careStatus = tab === 'rescue' && allowedCareStatuses.has(rawCareStatus)
    ? rawCareStatus as ListState['careStatus'] : ''
  const state: ListState = { tab, species, careStatus, page: parsePage(params.get('page')) }
  return { state, canonicalSearch: serialize(state) }
}

function apiUrl(state: ListState) {
  const params = new URLSearchParams()
  params.set('listing_type', state.tab === 'lost' ? 'LOST_REPORT' : 'SHELTER_ANIMAL')
  if (state.species) params.set('species', state.species)
  if (state.tab === 'rescue' && state.careStatus) params.set('care_status', state.careStatus)
  params.set('page', String(state.page - 1))
  params.set('size', String(PAGE_SIZE))
  return '/api/animals?' + params.toString()
}

function AnimalPhoto({ animal }: { animal: AnimalSummary }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [animal.imageUrl])
  return <span className='animal-list-photo'>
    {animal.imageUrl && !failed
      ? <img src={animal.imageUrl} alt={animal.name?.trim() || '동물'}
          loading='lazy' decoding='async' onError={() => setFailed(true)} />
      : <span className='animal-list-photo__fallback' role='img' aria-label='등록된 사진 없음'>🐾</span>}
  </span>
}

function AnimalCards({ animals, onOpen }: {
  animals: AnimalSummary[]
  onOpen: (animal: AnimalSummary, opener: HTMLButtonElement) => void
}) {
  return <div className='animal-cards'>{animals.map((animal) => {
    const name = animal.name?.trim() || animal.breedName?.trim() || '이름을 기다리는 동물'
    const status = animal.listingType === 'LOST_REPORT'
      ? '분실 신고' : statusNames[animal.careStatus] || '상태 미상'
    return <article className='animal-card' key={animal.id}>
      <button type='button' className='animal-card__button' aria-label={name + ' 상세 보기'}
        aria-haspopup='dialog' onClick={(event) => onOpen(animal, event.currentTarget)}>
        <AnimalPhoto animal={animal} />
        <span className={animal.listingType === 'LOST_REPORT' ? 'animal-tag animal-tag--lost' : 'animal-tag'}>{status}</span>
        <span className='animal-card__copy'><strong>{name}</strong>
          <span>{speciesNames[animal.species] || '동물'} · {animal.breedName?.trim() || '품종 미상'}</span>
        </span>
      </button>
    </article>
  })}</div>
}

function ListHeader({ navigate, headingRef }: {
  navigate: AnimalListNavigate
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const home = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    navigate('/')
  }
  return <>
    <header className='animal-header'>
      <a href='/' className='animal-brand' onClick={home}>Petever</a>
      <a href='/' className='animal-home-link' onClick={home}>홈으로</a>
    </header>
    <section className='animal-intro'>
      <p className='animal-eyebrow'>보호·분실 동물 소식</p>
      <h1 ref={headingRef} tabIndex={-1}>동물 전체보기</h1>
      <p>길을 잃은 동물과 새로운 가족을 기다리는 동물을 구분해 확인해 보세요.</p>
    </section>
  </>
}

function AnimalTabs({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ lost: null, rescue: null })
  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: Tab) => {
    const next = event.key === 'Home' ? 'lost' : event.key === 'End' ? 'rescue'
      : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? (tab === 'lost' ? 'rescue' : 'lost') : null
    if (!next) return
    event.preventDefault()
    onSelect(next)
    queueMicrotask(() => refs.current[next]?.focus())
  }
  return <div className='animal-tabs' role='tablist' aria-label='동물 목록 구분'>
    {([['lost', '분실동물'], ['rescue', '구조동물']] as const).map(([tab, label]) => <button
      key={tab} ref={(element) => { refs.current[tab] = element }} id={'animal-tab-' + tab}
      type='button' role='tab' aria-selected={active === tab} aria-controls='animal-list-panel'
      tabIndex={active === tab ? 0 : -1} onClick={() => onSelect(tab)}
      onKeyDown={(event) => keyDown(event, tab)}>{label}</button>)}
  </div>
}

function AnimalFilters({ state, go }: {
  state: ListState
  go: (next: Partial<ListState>) => void
}) {
  return <div className='animal-filters'>
    <label>동물 종류
      <select value={state.species}
        onChange={(event) => go({ species: event.target.value as ListState['species'], page: 1 })}>
        {speciesOptions.map(([value, label]) => <option value={value} key={value || 'all'}>{label}</option>)}
      </select>
    </label>
    {state.tab === 'rescue' && <label>보호 상태
      <select value={state.careStatus}
        onChange={(event) => go({ careStatus: event.target.value as ListState['careStatus'], page: 1 })}>
        {careStatusOptions.map(([value, label]) => <option value={value} key={value || 'all'}>{label}</option>)}
      </select>
    </label>}
  </div>
}

function ListResults({ data, error, state, emptyMessage, hasFilters, retry, reset, changePage, open }: {
  data: AnimalPage | null
  error: string
  state: ListState
  emptyMessage: string
  hasFilters: boolean
  retry: () => void
  reset: () => void
  changePage: (page: number) => void
  open: (animal: AnimalSummary, opener: HTMLButtonElement) => void
}) {
  return <>
    {error && <div className='animal-message animal-message--error' role='alert'>
      <p>{error}</p><button type='button' onClick={retry}>다시 시도</button>
    </div>}
    {!data && !error && <p className='animal-message' aria-live='polite'>동물을 불러오는 중입니다…</p>}
    {data?.content.length === 0 && <div className='animal-message'>
      <p>{emptyMessage}</p>
      {hasFilters && <button type='button' onClick={reset}>필터 초기화</button>}
    </div>}
    {data && data.content.length > 0 && <AnimalCards animals={data.content} onOpen={open} />}
    {data && data.totalPages > 1 && <nav className='animal-pagination' aria-label='페이지 이동'>
      <button type='button' disabled={state.page === 1} onClick={() => changePage(state.page - 1)}>이전</button>
      <span aria-live='polite'>{data.number + 1} / {data.totalPages}</span>
      <button type='button' disabled={state.page >= data.totalPages}
        onClick={() => changePage(state.page + 1)}>다음</button>
    </nav>}
  </>
}

export default function AnimalListPage({ search, navigate }: { search: string; navigate: AnimalListNavigate }) {
  const { state, canonicalSearch } = useMemo(() => parse(search), [search])
  const [data, setData] = useState<AnimalPage | null>(null)
  const [error, setError] = useState('')
  const [retryVersion, setRetryVersion] = useState(0)
  const [selected, setSelected] = useState<{ animal: AnimalSummary; opener: HTMLButtonElement } | null>(null)
  const requestId = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousQuery = useRef(canonicalSearch)

  useEffect(() => {
    if (search !== canonicalSearch) navigate('/animals' + canonicalSearch, { replace: true })
  }, [canonicalSearch, navigate, search])

  useEffect(() => {
    if (previousQuery.current !== canonicalSearch && selected) {
      setSelected(null)
      queueMicrotask(() => headingRef.current?.focus())
    }
    previousQuery.current = canonicalSearch
  }, [canonicalSearch])

  useEffect(() => {
    const controller = new AbortController()
    const currentRequest = ++requestId.current
    setData(null)
    setError('')
    fetch(apiUrl(state), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('REQUEST_FAILED')
        return response.json() as Promise<AnimalPage>
      })
      .then((pageData) => {
        if (controller.signal.aborted || currentRequest !== requestId.current) return
        if (pageData.totalPages > 0 && state.page > pageData.totalPages) {
          navigate('/animals' + serialize({ ...state, page: pageData.totalPages }), { replace: true })
          return
        }
        if (pageData.totalPages === 0 && state.page > 1) {
          navigate('/animals' + serialize({ ...state, page: 1 }), { replace: true })
          return
        }
        setData(pageData)
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted && currentRequest === requestId.current && reason.name !== 'AbortError') {
          setError('동물 목록을 불러오지 못했습니다.')
        }
      })
    return () => controller.abort()
  }, [canonicalSearch, navigate, retryVersion])

  const go = (next: Partial<ListState>, options?: { replace?: boolean }) => {
    navigate('/animals' + serialize({ ...state, ...next }), options)
  }
  const selectTab = (tab: Tab) => {
    go({ tab, careStatus: tab === 'lost' ? '' : state.careStatus, page: 1 })
  }
  const changePage = (page: number) => {
    go({ page })
    queueMicrotask(() => {
      headingRef.current?.focus()
      headingRef.current?.scrollIntoView?.({ block: 'start' })
    })
  }
  const closeAnimal = () => {
    const opener = selected?.opener
    setSelected(null)
    queueMicrotask(() => opener?.isConnected ? opener.focus() : headingRef.current?.focus())
  }
  const hasFilters = Boolean(state.species || state.careStatus)
  const emptyMessage = hasFilters ? '조건에 맞는 동물이 없습니다.'
    : state.tab === 'lost' ? '등록된 분실동물이 없습니다.' : '등록된 구조동물이 없습니다.'

  return <>
    <main className='animal-shell'>
      <ListHeader navigate={navigate} headingRef={headingRef} />
      <AnimalTabs active={state.tab} onSelect={selectTab} />
      <section id='animal-list-panel' className='animal-list-panel' role='tabpanel'
        aria-labelledby={'animal-tab-' + state.tab}>
        <div className='animal-list-toolbar'>
          <AnimalFilters state={state} go={go} />
          <p className='animal-result-count' aria-live='polite'>
            {data ? '총 ' + data.totalElements.toLocaleString('ko-KR') + '건' : '목록 확인 중'}
          </p>
        </div>
        <ListResults
          data={data}
          error={error}
          state={state}
          emptyMessage={emptyMessage}
          hasFilters={hasFilters}
          retry={() => setRetryVersion((value) => value + 1)}
          reset={() => go({ species: '', careStatus: '', page: 1 })}
          changePage={changePage}
          open={(animal, opener) => setSelected({ animal, opener })}
        />
      </section>
    </main>
    {selected && <AnimalDetailModal animal={selected.animal} onClosed={closeAnimal} />}
  </>
}
