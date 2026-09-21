import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('signup and login draft routes', () => {
  it('renders accessible signup fields at /signup', () => {
    window.history.replaceState({}, '', '/signup')
    render(<App />)

    expect(screen.getByLabelText('이메일')).toBeTruthy()
    expect(screen.getByLabelText('비밀번호').getAttribute('autocomplete')).toBe('new-password')
    expect(screen.getByLabelText('비밀번호 확인')).toBeTruthy()
    expect(screen.getByLabelText('닉네임')).toBeTruthy()
    expect(screen.getByLabelText('전화번호 (선택)')).toBeTruthy()
  })

  it('shows a disabled login draft at /login', () => {
    window.history.replaceState({}, '', '/login')
    render(<App />)

    expect((screen.getByRole('button', { name: '로그인 기능 준비 중' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('')
  })
})
