import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('signup and login routes', () => {
  it('renders accessible signup fields at /signup', () => {
    window.history.replaceState({}, '', '/signup')
    render(<App />)

    expect(screen.getByLabelText('이메일')).toBeTruthy()
    expect(screen.getByLabelText('비밀번호').getAttribute('autocomplete')).toBe('new-password')
    expect(screen.getByLabelText('비밀번호 확인')).toBeTruthy()
    expect(screen.getByLabelText('닉네임')).toBeTruthy()
    expect(screen.getByLabelText('전화번호 (선택)')).toBeTruthy()
  })

  it('shows an enabled login form at /login', () => {
    window.history.replaceState({}, '', '/login')
    render(<App />)

    expect((screen.getByRole('button', { name: '로그인' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('')
  })

  it('does not call the API for invalid input', async () => {
    window.history.replaceState({}, '', '/signup')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', withCsrf(fetchMock))
    render(<App />)
    fillSignup({ password: 'short', passwordConfirmation: 'different' })
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('비밀번호는 8자 이상이어야 합니다.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a multibyte password over 72 bytes before submitting', async () => {
    window.history.replaceState({}, '', '/signup')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', withCsrf(fetchMock))
    render(<App />)
    fillSignup({ password: '가'.repeat(25), passwordConfirmation: '가'.repeat(25) })
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(await screen.findByText('비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits the form and renders the login draft with the returned email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 7, email: 'user@example.com', nickname: '몽글집사',
    }), { status: 201 }))
    vi.stubGlobal('fetch', withCsrf(fetchMock))
    window.history.replaceState({}, '', '/signup')
    render(<App />)
    fillSignup({ email: ' USER@Example.com ' })
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    await screen.findByRole('heading', { name: '로그인' })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-token' },
    }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      email: 'user@example.com', password: 'valid-password', nickname: '몽글집사',
    })
    expect(window.location.pathname).toBe('/login')
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('user@example.com')
  })

  it('prevents a second submission while the first request is pending', async () => {
    window.history.replaceState({}, '', '/signup')
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', withCsrf(fetchMock))
    render(<App />)
    fillSignup()
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    await waitFor(() => expect((screen.getByRole('button', { name: '가입 중…' }) as HTMLButtonElement).disabled).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a 400 field error beside the password', async () => {
    await renderFailure(400, { code: 'INVALID_INPUT', message: '입력값을 확인해 주세요.', fieldErrors: { password: '비밀번호 오류' } })
    expect(await screen.findByText('비밀번호 오류')).toBeTruthy()
  })

  it('shows a 409 duplicate error beside the email', async () => {
    await renderFailure(409, { code: 'DUPLICATE_EMAIL', message: '이미 가입된 이메일입니다.', fieldErrors: {} })
    expect(await screen.findByText('이미 가입된 이메일입니다.')).toBeTruthy()
  })

  it('shows a recoverable alert when the network fails', async () => {
    window.history.replaceState({}, '', '/signup')
    vi.stubGlobal('fetch', withCsrf(vi.fn().mockRejectedValue(new Error('offline'))))
    render(<App />)
    fillSignup()
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect((await screen.findByRole('alert')).textContent).toContain('회원가입을 완료하지 못했습니다. 다시 시도해 주세요.')
  })

  it('does not keep signup email after a direct login page load', () => {
    window.history.replaceState({}, '', '/login')
    render(<App />)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('')
  })

  it('consumes the signup email so a reload starts with an empty field', () => {
    window.history.replaceState({ signupEmail: 'user@example.com' }, '', '/login')
    render(<App />)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('user@example.com')

    cleanup()
    render(<App />)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('')
  })
})

function fillSignup(overrides: Partial<Record<'email' | 'password' | 'passwordConfirmation' | 'nickname', string>> = {}) {
  const values = {
    email: 'user@example.com', password: 'valid-password',
    passwordConfirmation: 'valid-password', nickname: '몽글집사', ...overrides,
  }
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: values.passwordConfirmation } })
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: values.nickname } })
}

async function renderFailure(status: number, body: object) {
  window.history.replaceState({}, '', '/signup')
  vi.stubGlobal('fetch', withCsrf(vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))))
  render(<App />)
  fillSignup()
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
}


function withCsrf(fetchMock: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return (input: RequestInfo | URL, init?: RequestInit) => String(input) === '/api/auth/csrf'
    ? Promise.resolve(new Response(JSON.stringify({ token: 'csrf-token' })))
    : fetchMock(input, init)
}
