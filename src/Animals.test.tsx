import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type Summary = {
  id: number
  name: string | null
  species: string
  breedName: string | null
  careStatus: string
  listingType: 'LOST_REPORT' | 'SHELTER_ANIMAL'
  imageUrl: string | null
}

const lost: Summary = {
  id: 2, name: '나비', species: 'CAT', breedName: '코리안숏헤어',
  careStatus: 'UNKNOWN', listingType: 'LOST_REPORT', imageUrl: '/api/animals/images/18',
}
const rescue: Summary = {
  id: 1, name: '보리', species: 'DOG', breedName: '믹스견',
  careStatus: 'PROTECTED', listingType: 'SHELTER_ANIMAL', imageUrl: '/api/animals/images/17',
}

function page(content: Summary[], number = 0, totalPages = 1, totalElements = content.length) {
  return { content, number, totalPages, totalElements }
}
function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response)
}
function mockList(body = page([lost])) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => response(body)))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('animal browsing', () => {
  it('opens the lost tab by default and requests twenty animals', async () => {
    mockList()
    window.history.replaceState({}, '', '/animals')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '동물 전체보기' })).toBeTruthy()
    expect(await screen.findByText('나비')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '분실동물' }).getAttribute('aria-selected')).toBe('true')
    expect(window.location.search).toBe('?tab=lost')
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=LOST_REPORT&page=0&size=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('restores the rescue tab, filters and one-based page from a direct URL', async () => {
    mockList(page([rescue], 1, 3, 41))
    window.history.replaceState({}, '', '/animals?tab=rescue&species=DOG&care_status=PROTECTED&page=2')

    render(<App />)

    expect(await screen.findByText('보리')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '구조동물' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByLabelText('동물 종류')).toHaveProperty('value', 'DOG')
    expect(screen.getByLabelText('보호 상태')).toHaveProperty('value', 'PROTECTED')
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=SHELTER_ANIMAL&species=DOG&care_status=PROTECTED&page=1&size=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shows twenty cards when the page contains twenty animals', async () => {
    const animals = Array.from({ length: 20 }, (_, index) => ({
      ...lost, id: index + 1, name: '분실동물 ' + (index + 1),
    }))
    mockList(page(animals, 0, 2, 21))
    window.history.replaceState({}, '', '/animals?tab=lost')

    render(<App />)

    expect(await screen.findAllByRole('button', { name: /상세 보기$/ })).toHaveLength(20)
    expect(screen.getByText('총 21건')).toBeTruthy()
  })

  it('switches tabs, removes rescue-only state and supports arrow-key navigation', async () => {
    mockList(page([rescue], 1, 3, 41))
    window.history.replaceState({}, '', '/animals?tab=rescue&care_status=PROTECTED&page=2')
    render(<App />)
    await screen.findByText('보리')
    vi.mocked(fetch).mockClear()

    const rescueTab = screen.getByRole('tab', { name: '구조동물' })
    fireEvent.keyDown(rescueTab, { key: 'ArrowLeft' })

    await waitFor(() => expect(window.location.search).toBe('?tab=lost'))
    expect(screen.queryByLabelText('보호 상태')).toBeNull()
    expect(screen.getByRole('tab', { name: '분실동물' })).toBe(document.activeElement)
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=LOST_REPORT&page=0&size=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('restores tab and page state when popstate changes the URL', async () => {
    mockList(page([rescue], 1, 3, 41))
    window.history.replaceState({}, '', '/animals?tab=rescue&page=2')
    render(<App />)
    await screen.findByText('보리')

    fireEvent.click(screen.getByRole('tab', { name: '분실동물' }))
    await waitFor(() => expect(window.location.search).toBe('?tab=lost'))
    vi.mocked(fetch).mockClear()

    window.history.replaceState({}, '', '/animals?tab=rescue&page=2')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '구조동물' }).getAttribute('aria-selected')).toBe('true')
      expect(fetch).toHaveBeenCalledWith(
        '/api/animals?listing_type=SHELTER_ANIMAL&page=1&size=20',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
  })

  it('ignores a stale response after switching tabs', async () => {
    let resolveFirst!: (value: Response) => void
    const firstResponse = new Promise<Response>((resolve) => { resolveFirst = resolve })
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => firstResponse)
      .mockImplementation(() => response(page([rescue]))))
    window.history.replaceState({}, '', '/animals?tab=lost')
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: '구조동물' }))
    expect(await screen.findByText('보리')).toBeTruthy()

    await act(async () => {
      resolveFirst({ ok: true, json: async () => page([lost]) } as Response)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.queryByText('나비')).toBeNull()
    expect(screen.getByText('보리')).toBeTruthy()
  })

  it('replaces an out-of-range page with the last page and refetches it', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => response(page([], 8, 3, 41)))
      .mockImplementation(() => response(page([lost], 2, 3, 41))))
    window.history.replaceState({}, '', '/animals?tab=lost&page=9')
    const historyLength = window.history.length
    render(<App />)

    expect(await screen.findByText('나비')).toBeTruthy()
    expect(window.location.search).toBe('?tab=lost&page=3')
    expect(window.history.length).toBe(historyLength)
    expect(fetch).toHaveBeenCalledWith(
      '/api/animals?listing_type=LOST_REPORT&page=2&size=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('canonicalizes invalid, legacy, and page-boundary URLs with replaceState', async () => {
    const cases = [
      {
        input: '/animals?tab=foo&page=-1&species=X&care_status=PROTECTED',
        expected: '?tab=lost',
        expectedApi: '/api/animals?listing_type=LOST_REPORT&page=0&size=20',
        body: page([lost]),
      },
      {
        input: '/animals?listing_type=SHELTER_ANIMAL',
        expected: '?tab=rescue',
        expectedApi: '/api/animals?listing_type=SHELTER_ANIMAL&page=0&size=20',
        body: page([rescue]),
      },
      {
        input: '/animals?tab=lost&page=107374183',
        expected: '?tab=lost&page=107374183',
        expectedApi: '/api/animals?listing_type=LOST_REPORT&page=107374182&size=20',
        body: page([lost], 107374182, 107374183, 2_147_483_641),
      },
      {
        input: '/animals?tab=lost&page=107374184',
        expected: '?tab=lost',
        expectedApi: '/api/animals?listing_type=LOST_REPORT&page=0&size=20',
        body: page([lost]),
      },
    ]

    for (const testCase of cases) {
      cleanup()
      vi.unstubAllGlobals()
      mockList(testCase.body)
      window.history.replaceState({}, '', testCase.input)
      const historyLength = window.history.length

      render(<App />)

      await waitFor(() => expect(fetch).toHaveBeenCalled())
      await waitFor(() => expect(window.location.search).toBe(testCase.expected))
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        testCase.expectedApi,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
      expect(window.history.length).toBe(historyLength)
    }
  })

  it('does not add history or refetch when the active tab is selected again', async () => {
    mockList()
    window.history.replaceState({}, '', '/animals?tab=lost')
    render(<App />)
    await screen.findByText('나비')
    const historyLength = window.history.length
    const requestCount = vi.mocked(fetch).mock.calls.length

    fireEvent.click(screen.getByRole('tab', { name: '분실동물' }))

    expect(window.history.length).toBe(historyLength)
    expect(vi.mocked(fetch).mock.calls.length).toBe(requestCount)
  })

  it('closes an open modal and focuses the heading on popstate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === '/api/animals/2') return response({ ...lost, images: [], publicData: {} })
      if (String(input).includes('SHELTER_ANIMAL')) return response(page([rescue]))
      return response(page([lost]))
    }))
    window.history.replaceState({}, '', '/animals?tab=lost')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '나비 상세 보기' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()

    window.history.replaceState({}, '', '/animals?tab=rescue')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '동물 전체보기' }))
  })

  it('changes filters and pages through canonical URLs', async () => {
    mockList(page([rescue], 0, 3, 41))
    window.history.replaceState({}, '', '/animals?tab=rescue')
    render(<App />)
    await screen.findByText('보리')

    fireEvent.change(screen.getByLabelText('동물 종류'), { target: { value: 'DOG' } })
    await waitFor(() => expect(window.location.search).toBe('?tab=rescue&species=DOG'))

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(window.location.search).toBe('?tab=rescue&species=DOG&page=2'))
  })

  it('keeps lazy image behavior and replaces a failed image accessibly', async () => {
    mockList(page([rescue]))
    window.history.replaceState({}, '', '/animals?tab=rescue')
    render(<App />)

    const image = await screen.findByRole('img', { name: '보리' })
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('decoding')).toBe('async')
    fireEvent.error(image)

    expect(screen.queryByRole('img', { name: '보리' })).toBeNull()
    expect(screen.getByRole('img', { name: '등록된 사진 없음' })).toBeTruthy()
  })

  it('opens the current detail modal and restores focus after closing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === '/api/animals/2') return response({ ...lost, images: [], publicData: {} })
      return response(page([lost]))
    }))
    window.history.replaceState({}, '', '/animals?tab=lost')
    render(<App />)

    const opener = await screen.findByRole('button', { name: '나비 상세 보기' })
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '나비' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '상세 모달 닫기' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })

  it('shows errors, retries, and resets filters from an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => response({}, false))
      .mockImplementation(() => response(page([]))))
    window.history.replaceState({}, '', '/animals?tab=lost&species=CAT')
    render(<App />)

    expect((await screen.findByRole('alert')).textContent).toContain('동물 목록을 불러오지 못했습니다.')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('조건에 맞는 동물이 없습니다.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))

    await waitFor(() => expect(window.location.search).toBe('?tab=lost'))
  })

  it('keeps a lost report free of shelter contact on the legacy detail URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ...lost, foundPlace: '가상시 중구', images: [], shelterName: null, shelterPhone: null,
    }) }))
    window.history.replaceState({}, '', '/animals/2')
    render(<App />)

    expect(await screen.findByText('분실 신고')).toBeTruthy()
    expect(screen.getByText('분실 지역')).toBeTruthy()
    expect(screen.queryByText('보호소')).toBeNull()
  })

  it('renders the legacy detail route directly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      ...rescue, images: [], shelterName: '보호소', shelterPhone: '010-0000-0000',
    }) }))
    window.history.replaceState({}, '', '/animals/1')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '보리' })).toBeTruthy()
  })
})
