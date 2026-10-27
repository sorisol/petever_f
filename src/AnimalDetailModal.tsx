import { useEffect, useRef, useState } from 'react'
import KakaoShelterMap from './KakaoShelterMap'
import './animal-detail-modal.css'

export type AnimalModalSummary = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  imageUrl: string | null
  listingType: string
}

type AnimalDetail = AnimalModalSummary & {
  sex?: string
  ageDescription?: string | null
  foundPlace?: string | null
  description?: string | null
  shelterName?: string | null
  shelterPhone?: string | null
  images?: string[]
  publicData?: Partial<Record<AnimalDetailFieldKey, string>>
}

type FieldGroup = 'basic' | 'notice' | 'support'
type FieldDefinition = { key: AnimalDetailFieldKey; label: string; group: FieldGroup }

export const ANIMAL_DETAIL_FIELDS = [
  { key: 'desertionNo', label: '구조번호', group: 'basic' },
  { key: 'rfidCd', label: '동물등록번호', group: 'basic' },
  { key: 'happenDt', label: '접수일', group: 'basic' },
  { key: 'happenPlace', label: '발견장소', group: 'basic' },
  { key: 'kindCd', label: '품종', group: 'basic' },
  { key: 'colorCd', label: '색상', group: 'basic' },
  { key: 'age', label: '나이', group: 'basic' },
  { key: 'weight', label: '체중', group: 'basic' },
  { key: 'processState', label: '상태', group: 'basic' },
  { key: 'sexCd', label: '성별', group: 'basic' },
  { key: 'neuterYn', label: '중성화 여부', group: 'basic' },
  { key: 'specialMark', label: '특징', group: 'basic' },
  { key: 'noticeNo', label: '공고번호', group: 'notice' },
  { key: 'noticeSdt', label: '공고시작일', group: 'notice' },
  { key: 'noticeEdt', label: '공고종료일', group: 'notice' },
  { key: 'updTm', label: '수정일', group: 'notice' },
  { key: 'endReason', label: '처분사유', group: 'notice' },
  { key: 'careRegNo', label: '보호소번호', group: 'support' },
  { key: 'careNm', label: '보호소이름', group: 'support' },
  { key: 'careTel', label: '보호소전화번호', group: 'support' },
  { key: 'careAddr', label: '보호장소', group: 'support' },
  { key: 'orgNm', label: '관할기관', group: 'support' },
  { key: 'srvcTxt', label: '봉사안내·지원내용 및 신청방법', group: 'support' },
  { key: 'sprtEDate', label: '입양지원 종료일', group: 'support' },
  { key: 'popfile1', label: '대표 이미지', group: 'support' },
  { key: 'popfile4', label: '추가 이미지', group: 'support' },
  { key: 'evntImg', label: '행사안내 이미지', group: 'support' },
] as const satisfies readonly FieldDefinition[]

export type AnimalDetailFieldKey =
  | 'noticeNo' | 'srvcTxt' | 'popfile4' | 'sprtEDate' | 'desertionNo' | 'rfidCd'
  | 'happenDt' | 'happenPlace' | 'kindCd' | 'colorCd' | 'age' | 'weight' | 'evntImg'
  | 'updTm' | 'endReason' | 'careRegNo' | 'noticeSdt' | 'noticeEdt' | 'popfile1'
  | 'processState' | 'sexCd' | 'neuterYn' | 'specialMark' | 'careNm' | 'careTel'
  | 'careAddr' | 'orgNm'

const groupNames: Record<FieldGroup, string> = {
  basic: '동물 기본 정보', notice: '구조·공고 정보', support: '보호소·봉사·입양지원',
}
const imageFields = new Set<AnimalDetailFieldKey>(['popfile1', 'popfile4', 'evntImg'])
const sexNames: Record<string, string> = { M: '수컷', F: '암컷', Q: '미상' }
const neuterNames: Record<string, string> = { Y: '예', N: '아니오', U: '미상' }

function displayValue(detail: AnimalDetail, key: AnimalDetailFieldKey) {
  if (key === 'kindCd') return detail.breedName?.trim() || '—'
  const value = detail.publicData?.[key]?.trim()
  if (imageFields.has(key)) return value === 'Y' ? '등록됨' : '—'
  if (!value) return '—'
  if (key === 'sexCd') return sexNames[value] ? `${sexNames[value]} (${value})` : value
  if (key === 'neuterYn') return neuterNames[value] ? `${neuterNames[value]} (${value})` : value
  if (/^(happenDt|noticeSdt|noticeEdt|sprtEDate)$/.test(key) && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}. ${value.slice(4, 6)}. ${value.slice(6)}`
  }
  return value
}

function detailName(detail: AnimalModalSummary) {
  return detail.name?.trim() || detail.breedName?.trim() || '이름을 기다리는 동물'
}

function Gallery({ detail }: { detail: AnimalDetail }) {
  const images = detail.images?.length ? detail.images : detail.imageUrl ? [detail.imageUrl] : []
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState(false)
  const thumbs = useRef<Array<HTMLButtonElement | null>>([])
  const activeImage = images[selected]

  const select = (index: number) => {
    setSelected(index)
    setFailed(false)
  }
  const move = (index: number, direction: number) => {
    const next = (index + direction + images.length) % images.length
    select(next)
    thumbs.current[next]?.focus()
  }

  return <section className="animal-dialog__gallery" aria-label="동물 사진 갤러리">
    <div className="animal-dialog__main-photo">
      {activeImage && !failed
        ? <img src={activeImage} alt={`${detailName(detail)} 사진 ${selected + 1}`} onError={() => setFailed(true)} />
        : <div className="animal-dialog__photo-empty" role="img" aria-label="등록된 사진 없음"><span>사진 없음</span></div>}
      <span className="animal-dialog__photo-count" aria-live="polite">
        {images.length ? `${selected + 1} / ${images.length}` : '0 / 0'}
      </span>
    </div>
    {images.length > 1 && <div className="animal-dialog__thumbs" aria-label="사진 선택">
      {images.map((image, index) => <button
        key={image}
        ref={(element) => { thumbs.current[index] = element }}
        type="button"
        aria-label={`사진 ${index + 1} 보기`}
        aria-pressed={selected === index}
        onClick={() => select(index)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(index, 1) }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(index, -1) }
        }}
      ><img src={image} alt="" /></button>)}
    </div>}
  </section>
}

function DetailContent({ detail }: { detail: AnimalDetail }) {
  const data = detail.publicData ?? {}
  const isLost = detail.listingType === 'LOST_REPORT'
  const phone = data.careTel || detail.shelterPhone || ''
  const shelter = data.careNm || detail.shelterName || '보호소 정보 없음'
  const address = data.careAddr?.trim() || ''
  const tel = phone.replace(/[^0-9+-]/g, '')
  const quick = [
    ['상태', data.processState || (isLost ? '분실 신고' : '보호 중')],
    ['성별', data.sexCd ? sexNames[data.sexCd] || data.sexCd : detail.sex === 'FEMALE' ? '암컷' : detail.sex === 'MALE' ? '수컷' : '미상'],
    ['중성화', data.neuterYn ? neuterNames[data.neuterYn] || data.neuterYn : '미상'],
    ['체중', data.weight || '미상'],
  ]

  return <>
    <header className="animal-dialog__head">
      <span className="animal-dialog__eyebrow">{isLost ? 'LOST ANIMAL · 분실동물' : 'SHELTER ANIMAL · 보호동물'}</span>
      <h2 id="animal-dialog-title">{detailName(detail)}</h2>
      <p>{data.specialMark || detail.description || '상세 정보를 확인해 주세요.'}</p>
    </header>
    <div className="animal-dialog__quick">
      {quick.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <section className="animal-dialog__contact" aria-label="보호소 연락처">
      <strong>{shelter}</strong>
      {tel && <a href={`tel:${tel}`}>{phone} 전화하기</a>}
      <address>{address || '보호장소 정보 없음'}</address>
      <span>{data.orgNm || '관할기관 정보 없음'}</span>
      {!isLost && address && <KakaoShelterMap name={shelter} address={address} />}
    </section>
    {(['basic', 'notice', 'support'] as const).map((group, index) => <details key={group} open={index === 0}>
      <summary>{groupNames[group]}</summary>
      <dl>
        {ANIMAL_DETAIL_FIELDS.filter((field) => field.group === group).map((field) => <div key={field.key}>
          <dt>{field.key === 'happenDt' && isLost ? '발생일' : field.label}</dt>
          <dd>{displayValue(detail, field.key)}</dd>
        </div>)}
      </dl>
    </details>)}
  </>
}

export default function AnimalDetailModal({
  animal,
  onClosed,
}: {
  animal: AnimalModalSummary
  onClosed: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const backdropPress = useRef(false)
  const requestId = useRef(0)
  const [detail, setDetail] = useState<AnimalDetail | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    queueMicrotask(() => closeRef.current?.focus())
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const currentRequest = ++requestId.current
    setDetail(null)
    setError('')
    fetch(`/api/animals/${animal.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED')
        return response.json() as Promise<AnimalDetail>
      })
      .then((result) => {
        if (!controller.signal.aborted && currentRequest === requestId.current) setDetail(result)
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted && currentRequest === requestId.current) {
          setError(reason.message === 'NOT_FOUND' ? '더 이상 공개되지 않는 동물입니다.' : '상세 정보를 불러오지 못했습니다.')
        }
      })
    return () => controller.abort()
  }, [animal.id, retry])

  const close = () => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.close === 'function') dialog.close()
    else { dialog.removeAttribute('open'); onClosed() }
  }

  return <dialog
    ref={dialogRef}
    className="animal-dialog"
    aria-labelledby="animal-dialog-title"
    aria-busy={!detail && !error}
    onClose={onClosed}
    onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget }}
    onClick={(event) => {
      if (backdropPress.current && event.target === event.currentTarget) close()
      backdropPress.current = false
    }}
  >
    <div className="animal-dialog__frame">
      <button ref={closeRef} className="animal-dialog__close" type="button" aria-label="상세 모달 닫기" onClick={close}>×</button>
      {detail ? <>
        <Gallery key={detail.id} detail={detail} />
        <section className="animal-dialog__details" tabIndex={0} aria-label="동물 상세 정보"><DetailContent detail={detail} /></section>
      </> : <section className="animal-dialog__state">
        <h2 id="animal-dialog-title">{detailName(animal)}</h2>
        {error
          ? <><p role="alert">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></>
          : <p>상세 정보를 불러오는 중…</p>}
      </section>}
    </div>
  </dialog>
}
