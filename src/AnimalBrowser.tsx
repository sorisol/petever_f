import { type MouseEvent as ReactMouseEvent, useEffect, useState } from 'react'
import AnimalListPage, { type AnimalListNavigate, isPlainLeftClick } from './AnimalListPage'
import './animal-browser.css'

type AnimalDetail = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  listingType: 'LOST_REPORT' | 'SHELTER_ANIMAL'
  imageUrl: string | null
  sex?: string
  ageDescription?: string | null
  foundPlace?: string | null
  description?: string | null
  shelterName?: string | null
  shelterPhone?: string | null
  images?: string[]
}

const statusNames: Record<string, string> = {
  PROTECTED: '보호 중', ADOPTED: '입양 완료', RETURNED: '반환',
  TRANSFERRED: '이관', DECEASED: '사망', OTHER_CLOSED: '종료', UNKNOWN: '상태 미상',
}
const speciesNames: Record<string, string> = {
  DOG: '강아지', CAT: '고양이', OTHER: '기타', UNKNOWN: '미확인',
}

function AnimalPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <div className='animal-detail-photo'>
    {src && !failed
      ? <img src={src} alt={alt} loading='lazy' decoding='async' onError={() => setFailed(true)} />
      : <span>🐾</span>}
  </div>
}

function AnimalDetailPage({ id, navigate }: { id: string; navigate: AnimalListNavigate }) {
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

  const listLink = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    navigate('/animals')
  }

  return <main className='animal-shell'>
    <header className='animal-header'>
      <a href='/animals' onClick={listLink} className='animal-brand'>Petever</a>
      <span>동물 소식</span>
    </header>
    <a href='/animals' onClick={listLink} className='animal-back'>← 목록으로</a>
    {error && <p role='alert' className='animal-message'>{error}</p>}
    {!animal && !error && <p className='animal-message'>동물 정보를 불러오는 중입니다…</p>}
    {animal && <AnimalDetailView animal={animal} />}
  </main>
}

function AnimalDetailView({ animal }: { animal: AnimalDetail }) {
  return <article className='animal-detail'>
    <AnimalPhoto src={animal.images?.[0] ?? null} alt={animal.name || '보호 동물'} />
    <div className='animal-detail-body'>
      <span className='animal-tag'>
        {animal.listingType === 'LOST_REPORT'
          ? '분실 신고'
          : statusNames[animal.careStatus] || '상태 미상'}
      </span>
      <h1>{animal.name || animal.breedName || '이름을 기다리는 동물'}</h1>
      <dl>
        <div><dt>종류</dt><dd>{speciesNames[animal.species] || '미확인'}</dd></div>
        <div><dt>품종</dt><dd>{animal.breedName || '미확인'}</dd></div>
        <div><dt>성별</dt><dd>{animal.sex === 'MALE' ? '수컷' : animal.sex === 'FEMALE' ? '암컷' : '미확인'}</dd></div>
        <div><dt>나이</dt><dd>{animal.ageDescription || '미확인'}</dd></div>
        <div><dt>{animal.listingType === 'LOST_REPORT' ? '분실 지역' : '발견 장소'}</dt><dd>{animal.foundPlace || '미확인'}</dd></div>
      </dl>
      {animal.description && <p className='animal-description'>{animal.description}</p>}
      {animal.listingType !== 'LOST_REPORT' && <div className='animal-shelter'>
        <strong>{animal.shelterName || '보호소'}</strong>
        {animal.shelterPhone && <a href={'tel:' + animal.shelterPhone}>{animal.shelterPhone}</a>}
      </div>}
    </div>
  </article>
}

export default function AnimalBrowser({
  path,
  search,
  navigate,
}: {
  path: string
  search: string
  navigate: AnimalListNavigate
}) {
  const match = path.match(/^\/animals\/(\d+)\/?$/)
  if (match) return <AnimalDetailPage id={match[1]} navigate={navigate} />
  return <AnimalListPage search={search} navigate={navigate} />
}
