import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ANIMAL_DETAIL_FIELDS } from './AnimalDetailModal'

type AnimalPage = {
  content: Array<{
    id: number
    name: string | null
    species: string
    breedName: string | null
    careStatus: string
    imageUrl: string | null
    listingType: string
  }>
  number: number
  totalPages: number
  totalElements: number
}

const shelterPage: AnimalPage = {
  content: [
    {
      id: 1,
      name: '몽글이',
      species: 'DOG',
      breedName: '믹스견',
      careStatus: 'PROTECTED',
      imageUrl: '/api/animals/images/11',
      listingType: 'SHELTER_ANIMAL',
    },
  ],
  number: 0,
  totalPages: 1,
  totalElements: 248,
}

const lostPage: AnimalPage = {
  content: [
    {
      id: 2,
      name: null,
      species: 'CAT',
      breedName: null,
      careStatus: 'UNKNOWN',
      imageUrl: null,
      listingType: 'LOST_REPORT',
    },
  ],
  number: 0,
  totalPages: 1,
  totalElements: 31,
}

const shelterDetail = {
  ...shelterPage.content[0],
  sex: 'FEMALE',
  images: ['/api/animals/images/11', '/api/animals/images/12'],
  shelterName: '마포동물보호센터',
  shelterPhone: '02-3153-8542',
  publicData: {
    noticeNo: '서울-마포-2026-00142', desertionNo: '411313202600142', happenDt: '20261011',
    happenPlace: '문화비축기지 앞', kindCd: '000114', colorCd: '갈색 · 흰색', age: '2024년생 추정',
    weight: '8.4kg', processState: '보호 중', sexCd: 'F', neuterYn: 'Y', specialMark: '사람을 좋아합니다.',
    careNm: '마포동물보호센터', careTel: '02-3153-8542', careAddr: '서울 마포구 매봉산로 31',
    orgNm: '서울특별시 마포구', popfile1: 'Y', popfile4: 'Y', evntImg: 'Y',
  },
}

const lostDetail = {
  ...lostPage.content[0],
  images: [],
  publicData: { kindCd: '코리안숏헤어', happenDt: '20261010', orgNm: '서울특별시' },
}

function response<T>(body: T, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

function mockPages(shelter = shelterPage, lost = lostPage) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/animals/1') return response(shelterDetail)
      if (url === '/api/animals/2') return response(lostDetail)
      return response(url.includes('SHELTER_ANIMAL') ? shelter : lost)
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('concept-03 animal dashboard', () => {
  it('renders live shelter and lost-animal data from the documented queries', async () => {
    mockPages()

    render(<App />)

    expect(await screen.findByText('몽글이 · 믹스견')).toBeTruthy()
    expect(screen.getByText('이름 미상 · 품종 미상')).toBeTruthy()
    expect(screen.getByText('보호 중')).toBeTruthy()
    expect(screen.getByText('분실 신고')).toBeTruthy()
    expect(screen.getByText('248')).toBeTruthy()
    expect(screen.getByText('31')).toBeTruthy()
    expect(screen.getByText('사진 없음')).toBeTruthy()

    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=SHELTER_ANIMAL&size=8',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=LOST_REPORT&size=8',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('places lost animals before shelter animals in the navigation and dashboard', async () => {
    mockPages()
    render(<App />)
    await screen.findByText('분실 신고')

    const navigation = screen.getByRole('navigation', { name: '주요 메뉴' })
    const sectionLinks = Array.from(navigation.querySelectorAll('a[href="#lost"], a[href="#rescue"]'))
      .map((link) => link.textContent)
    expect(sectionLinks).toEqual(['분실동물', '구조동물'])

    const lostSection = document.querySelector('#lost')
    const shelterSection = document.querySelector('#rescue')
    expect(lostSection).not.toBeNull()
    expect(shelterSection).not.toBeNull()
    expect(lostSection!.compareDocumentPosition(shelterSection!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .not.toBe(0)
  })

  it('renders lost animals with the same image-card structure as shelter animals', async () => {
    mockPages()
    render(<App />)
    await screen.findByText('분실 신고')

    const lostSection = document.querySelector('#lost')
    const shelterSection = document.querySelector('#rescue')
    const lostCard = lostSection?.querySelector('.dash-grid > .dash-card')
    const shelterCard = shelterSection?.querySelector('.dash-grid > .dash-card')

    expect(lostCard).not.toBeNull()
    expect(shelterCard).not.toBeNull()
    expect(lostCard?.querySelector('.dash-card-copy')).not.toBeNull()
    expect(lostCard?.querySelector('.dash-card-photo .urgent')?.textContent).toBe('분실 신고')
    expect(lostSection?.querySelector('.lost-table')).toBeNull()
  })

  it('opens the approved detail dialog from both animal image buttons', async () => {
    mockPages()
    render(<App />)

    const shelterButton = await screen.findByRole('button', { name: '몽글이 상세 보기' })
    expect(screen.getByRole('button', { name: '이름 미상 상세 보기' })).toBeTruthy()
    expect(shelterButton.getAttribute('aria-describedby')).toBe('animal-status-1')
    expect(document.getElementById('animal-status-1')?.textContent).toBe('보호 중')
    fireEvent.click(shelterButton)

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: '몽글이' })).toBeTruthy()
    expect(screen.getByText('서울-마포-2026-00142')).toBeTruthy()
    expect(screen.getByText('믹스견')).toBeTruthy()
    expect(screen.queryByText('000114')).toBeNull()
    expect(screen.getAllByText('사람을 좋아합니다.')).toHaveLength(2)
    expect(fetch).toHaveBeenCalledWith('/api/animals/1', expect.objectContaining({ signal: expect.any(AbortSignal) }))

    fireEvent.click(screen.getByRole('button', { name: '상세 모달 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '이름 미상 상세 보기' }))

    const lostDialog = await screen.findByRole('dialog')
    expect(await within(lostDialog).findByRole('heading', { name: '이름을 기다리는 동물' })).toBeTruthy()
    expect(within(lostDialog).getByRole('img', { name: '등록된 사진 없음' })).toBeTruthy()
    expect(within(lostDialog).queryByLabelText('사진 선택')).toBeNull()
    expect(within(lostDialog).getByText('발생일')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/animals/2', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('does not fall back to a numeric raw breed code when the normalized name is missing', async () => {
    const detailWithoutBreed = {
      ...shelterDetail,
      breedName: null,
      publicData: { ...shelterDetail.publicData, kindCd: '000020' },
    }
    mockPages()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/animals/1') return response(detailWithoutBreed)
      return response(url.includes('SHELTER_ANIMAL') ? shelterPage : lostPage)
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '몽글이 상세 보기' }))

    const dialog = await screen.findByRole('dialog')
    const breedRow = within(dialog).getByText('품종').closest('div')
    expect(breedRow?.querySelector('dd')?.textContent).toBe('—')
    expect(within(dialog).queryByText('000020')).toBeNull()
  })

  it('switches gallery images and restores focus after closing', async () => {
    mockPages()
    render(<App />)
    const opener = await screen.findByRole('button', { name: '몽글이 상세 보기' })
    fireEvent.click(opener)
    await screen.findByRole('heading', { name: '몽글이' })

    fireEvent.click(screen.getByRole('button', { name: '사진 2 보기' }))
    expect(screen.getByRole('img', { name: '몽글이 사진 2' }).getAttribute('src')).toBe('/api/animals/images/12')
    fireEvent.click(screen.getByRole('button', { name: '상세 모달 닫기' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })

  it('keeps the requested public detail field contract at exactly 27 keys', () => {
    expect(ANIMAL_DETAIL_FIELDS).toHaveLength(27)
    expect(new Set(ANIMAL_DETAIL_FIELDS.map((field) => field.key)).size).toBe(27)
  })

  it('shows a retry action when the detail request fails', async () => {
    mockPages()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/animals/1') return response({}, false)
      return response(url.includes('SHELTER_ANIMAL') ? shelterPage : lostPage)
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '몽글이 상세 보기' }))

    expect((await screen.findByRole('alert')).textContent).toContain('상세 정보를 불러오지 못했습니다.')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('loads the home dashboard for an unknown animals path', async () => {
    window.history.replaceState({}, '', '/animals/unknown')
    mockPages()

    render(<App />)

    expect(await screen.findByText('몽글이 · 믹스견')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=SHELTER_ANIMAL&size=8',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('opens the existing animal browser from the home navigation', async () => {
    mockPages()
    render(<App />)
    await screen.findByText('몽글이 · 믹스견')

    fireEvent.click(screen.getByRole('link', { name: '전체 동물 보기' }))

    expect(await screen.findByRole('heading', { name: '동물 소식 둘러보기' })).toBeTruthy()
  })

  it('refetches only shelter animals when the species filter changes', async () => {
    mockPages()
    render(<App />)
    await screen.findByText('몽글이 · 믹스견')
    vi.mocked(fetch).mockClear()

    fireEvent.click(screen.getByRole('button', { name: '고양이' }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/animals?listing_type=SHELTER_ANIMAL&size=8&species=CAT',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the latest species result when an earlier request finishes later', async () => {
    let finishDog: ((value: Response) => void) | undefined
    mockPages()
    render(<App />)
    await screen.findByText('몽글이 · 믹스견')

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('species=DOG')) {
        return new Promise<Response>((resolve) => {
          finishDog = resolve
        })
      }
      return response({
        ...shelterPage,
        content: [{ ...shelterPage.content[0], id: 3, name: '나비', species: 'CAT' }],
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '강아지' }))
    fireEvent.click(screen.getByRole('button', { name: '고양이' }))
    expect(await screen.findByText('나비 · 믹스견')).toBeTruthy()

    finishDog?.(
      (await response({
        ...shelterPage,
        content: [{ ...shelterPage.content[0], id: 4, name: '늦은 응답' }],
      })) as Response,
    )

    await waitFor(() => expect(screen.queryByText('늦은 응답 · 믹스견')).toBeNull())
    expect(screen.getByText('나비 · 믹스견')).toBeTruthy()
  })

  it('does not label stale cards or counts as the newly selected species', async () => {
    let failCat: ((reason: Error) => void) | undefined
    mockPages()
    render(<App />)
    await screen.findByText('몽글이 · 믹스견')

    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((_, reject) => {
          failCat = reject
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: '고양이' }))

    await waitFor(() => expect(screen.queryByText('몽글이 · 믹스견')).toBeNull())
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('불러오는 중…')).toBeTruthy()

    await act(async () => failCat?.(new Error('network unavailable')))

    expect(await screen.findByText('구조동물을 불러오지 못했습니다.')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('몽글이 · 믹스견')).toBeNull()
  })

  it('shows independent empty and HTTP error states and retries both sections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('SHELTER_ANIMAL')
          ? response({ ...shelterPage, content: [], totalElements: 0 })
          : response(lostPage, false),
      ),
    )
    render(<App />)

    expect(await screen.findByText('조건에 맞는 구조동물이 없습니다.')).toBeTruthy()
    expect(await screen.findByText('분실동물을 불러오지 못했습니다.')).toBeTruthy()
    vi.mocked(fetch).mockClear()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })

  it('replaces an image that fails to load with an accessible fallback', async () => {
    mockPages()
    render(<App />)
    const image = await screen.findByRole('img', { name: '몽글이 사진' })

    fireEvent.error(image)

    expect(screen.queryByRole('img', { name: '몽글이 사진' })).toBeNull()
    expect(screen.getAllByText('사진 없음')).toHaveLength(2)
  })
})
