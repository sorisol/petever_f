import { useEffect } from 'react'

type Navigate = (to: string, state?: Record<string, unknown>) => void

export default function LoginDraftPage({ navigate, email }: { navigate: Navigate; email: string }) {
  useEffect(() => {
    if (window.history.state?.signupEmail !== undefined) {
      const { signupEmail: _consumed, ...remaining } = window.history.state
      window.history.replaceState(remaining, '', window.location.href)
    }
  }, [])

  return (
    <main className="auth-main" id="main">
      <section className="auth-card" aria-labelledby="login-title">
        <a className="auth-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}>Petever</a>
        <span className="auth-overline">다시 만나서 반가워요</span>
        <h1 id="login-title">로그인</h1>
        <p className="auth-description">회원가입을 마쳤다면 이메일이 미리 입력돼 있어요.</p>
        <div className="auth-form">
          <label>이메일<input type="email" autoComplete="email" defaultValue={email} /></label>
          <label>비밀번호<input type="password" autoComplete="current-password" /></label>
          <button type="button" className="auth-primary" disabled>로그인 기능 준비 중</button>
        </div>
        <p className="auth-note" role="status">로그인 기능은 준비 중입니다. 아직 로그인을 시도할 수 없어요.</p>
        <p className="auth-bottom">처음 오셨나요? <a href="/signup" onClick={(event) => { event.preventDefault(); navigate('/signup') }}>회원가입</a></p>
      </section>
    </main>
  )
}
