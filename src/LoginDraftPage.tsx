import { useEffect, useRef, useState, type FormEvent } from 'react'
import { csrfToken, isAccount, type Account } from './authApi'

type Navigate = (to: string, state?: Record<string, unknown>) => void

export default function LoginDraftPage({ navigate, email, onLogin }: {
  navigate: Navigate; email: string; onLogin: (account: Account) => void
}) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (window.history.state?.signupEmail !== undefined) {
      const { signupEmail: _consumed, ...remaining } = window.history.state
      window.history.replaceState(remaining, '', window.location.href)
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const address = String(data.get('email') ?? '').trim().toLowerCase()
    const password = String(data.get('password') ?? '')
    setError('')
    if (!address || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    submitting.current = true
    setPending(true)
    try {
      const token = await csrfToken()
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
        body: JSON.stringify({ email: address, password }),
      })
      if (response.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        return
      }
      if (!response.ok) throw new Error('Login failed')
      const account: unknown = await response.json()
      if (!isAccount(account)) throw new Error('Invalid login response')
      onLogin(account)
      navigate('/')
    } catch {
      setError('로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <main className="auth-main" id="main">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="auth-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}>Petever</a>
        <span className="auth-overline">다시 만나서 반가워요</span>
        <h1 id="login-title">로그인</h1>
        <form className="auth-form" onSubmit={submit} noValidate>
          <label>이메일<input name="email" type="email" autoComplete="email" defaultValue={email} /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" /></label>
          {error && <p className="auth-form-error" role="alert">{error}</p>}
          <button type="submit" className="auth-primary" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>
        </form>
        <p className="auth-bottom">처음 오셨나요? <a href="/signup" onClick={(event) => { event.preventDefault(); navigate('/signup') }}>회원가입</a></p>
      </section>
    </main>
  )
}