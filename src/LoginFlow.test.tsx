import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

it('logs in with a CSRF token and shows the member on the home page', async () => {
  window.history.replaceState({}, '', '/login')
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/auth/csrf') return Promise.resolve(new Response(JSON.stringify({ token: 'csrf-token' })))
    if (url === '/api/auth/login') return Promise.resolve(new Response(JSON.stringify({
      id: 42, email: 'member@example.com', nickname: '회원',
    })))
    if (url.startsWith('/api/animals')) return Promise.resolve(new Response(JSON.stringify({
      content: [], number: 0, totalPages: 0, totalElements: 0,
    })))
    throw new Error('Unexpected request: ' + url + ' ' + init?.method)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'valid-password' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('회원')).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-token' },
  }))
})

it('restores the member on reload and logs out', async () => {
  window.history.replaceState({}, '', '/')
  let loggedOut = false
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/session' && loggedOut) return Promise.resolve(new Response(null, { status: 401 }))
    if (url === '/api/auth/session') return Promise.resolve(new Response(JSON.stringify({
      id: 42, email: 'member@example.com', nickname: '회원',
    })))
    if (url === '/api/auth/csrf') return Promise.resolve(new Response(JSON.stringify({ token: 'csrf-token' })))
    if (url === '/api/auth/logout') { loggedOut = true; return Promise.resolve(new Response(null, { status: 204 })) }
    if (url.startsWith('/api/animals')) return Promise.resolve(new Response(JSON.stringify({
      content: [], number: 0, totalPages: 0, totalElements: 0,
    })))
    throw new Error('Unexpected request: ' + url)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)

  expect(await screen.findByText('회원')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(screen.getByRole('link', { name: '로그인' })).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
    method: 'POST', headers: { 'X-CSRF-TOKEN': 'csrf-token' },
  }))
})

it('shows one generic error for invalid credentials and stays on login', async () => {
  window.history.replaceState({}, '', '/login')
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/auth/csrf') {
      return Promise.resolve(new Response(JSON.stringify({ token: 'csrf-token' })))
    }
    return Promise.resolve(new Response(JSON.stringify({
      code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.', fieldErrors: {},
    }), { status: 401 }))
  }))
  render(<App />)
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'missing@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong-password' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect((await screen.findByRole('alert')).textContent).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
  expect(window.location.pathname).toBe('/login')
})
