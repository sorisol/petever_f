type Navigate = (to: string, state?: Record<string, unknown>) => void

export default function SignupPage({ navigate }: { navigate: Navigate }) {
  return (
    <main className="auth-main" id="main">
      <section className="auth-card" aria-labelledby="signup-title">
        <a className="auth-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}>Petever</a>
        <span className="auth-overline">함께하는 첫걸음</span>
        <h1 id="signup-title">회원가입</h1>
        <p className="auth-description">소중한 생명과 이어지는 이야기를 시작해요.</p>
        <form className="auth-form">
          <label>이메일<input name="email" type="email" autoComplete="email" /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="new-password" /></label>
          <label>비밀번호 확인<input name="passwordConfirmation" type="password" autoComplete="new-password" /></label>
          <label>닉네임<input name="nickname" type="text" autoComplete="nickname" /></label>
          <label>전화번호 (선택)<input name="phone" type="tel" autoComplete="tel" /></label>
          <button type="button" className="auth-primary">회원가입</button>
        </form>
        <p className="auth-bottom">이미 계정이 있나요? <a href="/login" onClick={(event) => { event.preventDefault(); navigate('/login') }}>로그인</a></p>
      </section>
    </main>
  )
}
