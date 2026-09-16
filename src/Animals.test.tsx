import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('animal browsing', () => {
  it('renders animals from the public list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      content: [{ id: 1, name: null, species: 'DOG', breedName: '믹스견', careStatus: 'PROTECTED', imageUrl: null }],
      number: 0, totalPages: 1,
    }) }))
    window.history.replaceState({}, '', '/animals')
    render(<App />)
    expect(await screen.findByText('믹스견')).toBeTruthy()
  })

  it('loads proxied animal images lazily with asynchronous decoding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      content: [{
        id: 1, name: '보리', species: 'DOG', breedName: '믹스견', careStatus: 'PROTECTED',
        listingType: 'SHELTER_ANIMAL', imageUrl: '/api/animals/images/17',
      }],
      number: 0, totalPages: 1,
    }) }))
    window.history.replaceState({}, '', '/animals')
    render(<App />)

    const image = await screen.findByRole('img', { name: '보리' })
    expect(image.getAttribute('src')).toBe('/api/animals/images/17')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('decoding')).toBe('async')
  })

  it('replaces an image that fails to load with the paw placeholder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      content: [{
        id: 1, name: '보리', species: 'DOG', breedName: '믹스견', careStatus: 'PROTECTED',
        listingType: 'SHELTER_ANIMAL', imageUrl: '/api/animals/images/17',
      }],
      number: 0, totalPages: 1,
    }) }))
    window.history.replaceState({}, '', '/animals')
    render(<App />)

    fireEvent.error(await screen.findByRole('img', { name: '보리' }))

    expect(screen.queryByRole('img', { name: '보리' })).toBeNull()
    expect(screen.getByText('🐾')).toBeTruthy()
  })

  it('labels a lost report without showing a shelter or contact', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      id: 2, name: null, species: 'DOG', breedName: '믹스견',
      careStatus: 'UNKNOWN', listingType: 'LOST_REPORT', foundPlace: '가상시 중구',
      images: [], shelterName: null, shelterPhone: null,
    }) }))
    window.history.replaceState({}, '', '/animals/2')
    render(<App />)
    expect(await screen.findByText('분실 신고')).toBeTruthy()
    expect(screen.getByText('분실 지역')).toBeTruthy()
    expect(screen.queryByText('보호소')).toBeNull()
  })
  it('renders detail at a direct URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      id: 1, name: '보리', species: 'DOG', breedName: '믹스견', careStatus: 'PROTECTED',
      images: [], shelterName: '보호소', shelterPhone: '010-0000-0000',
    }) }))
    window.history.replaceState({}, '', '/animals/1')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '보리' })).toBeTruthy()
  })
})
