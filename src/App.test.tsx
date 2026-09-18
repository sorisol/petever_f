import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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

function response(body: AnimalPage, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)
}

function mockPages(shelter = shelterPage, lost = lostPage) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      response(String(input).includes('SHELTER_ANIMAL') ? shelter : lost),
    ),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('concept-03 animal dashboard', () => {
  it('renders live shelter and lost-animal data from the documented queries', async () => {
    mockPages()

    render(<App />)

    expect(await screen.findByText('몽글이 · 믹스견')).toBeTruthy()
    expect(screen.getByText('이름 미상')).toBeTruthy()
    expect(screen.getByText('품종 미상')).toBeTruthy()
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
