import { useRef, useState, type FormEvent } from 'react'

type Navigate = (to: string, state?: Record<string, unknown>) => void
type Field = 'email' | 'password' | 'passwordConfirmation' | 'nickname' | 'phone'
type FieldErrors = Partial<Record<Field, string>>

const genericError = '회원가입을 완료하지 못했습니다. 다시 시도해 주세요.'

function validate(email: string, password: string, confirmation: string, nickname: string, phone: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = '올바른 이메일을 입력해 주세요.'
  if ([...password].length < 8) errors.password = '비밀번호는 8자 이상이어야 합니다.'
  else if (new TextEncoder().encode(password).length > 72) errors.password = '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.'
  if (password !== confirmation) errors.passwordConfirmation = '비밀번호가 일치하지 않습니다.'
  if ([...nickname].length < 2 || [...nickname].length > 50) errors.nickname = '닉네임은 2자 이상 50자 이하여야 합니다.'
  if ([...phone].length > 30) errors.phone = '전화번호는 30자 이하여야 합니다.'
  return errors
}

export default function SignupPage({ navigate }: { navigate: Navigate }) {
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const password = String(data.get('password') ?? '')
    const passwordConfirmation = String(data.get('passwordConfirmation') ?? '')
    const nickname = String(data.get('nickname') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const invalid = validate(email, password, passwordConfirmation, nickname, phone)
    setErrors(invalid)
    setFormError('')
    if (Object.keys(invalid).length) return

    submitting.current = true
    setPending(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, passwordConfirmation, nickname, phone: phone || null }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        if (typeof result === 'object' && result !== null) {
          const error = result as { code?: unknown; message?: unknown; fieldErrors?: unknown }
          if (error.code === 'DUPLICATE_EMAIL') {
            setErrors({ email: typeof error.message === 'string' ? error.message : '이미 가입된 이메일입니다.' })
            return
          }
          if (error.code === 'INVALID_INPUT' && typeof error.fieldErrors === 'object' && error.fieldErrors !== null) {
            const fields = error.fieldErrors as Record<string, unknown>
            const serverErrors: FieldErrors = {}
            for (const key of ['email', 'password', 'passwordConfirmation', 'nickname', 'phone'] as Field[]) {
              if (typeof fields[key] === 'string') serverErrors[key] = fields[key]
            }
            if (Object.keys(serverErrors).length) {
              setErrors(serverErrors)
              return
            }
          }
        }
        throw new Error('Unexpected signup response')
      }
      if (response.status !== 201 || typeof result !== 'object' || result === null
          || typeof (result as { email?: unknown }).email !== 'string') throw new Error('Invalid signup response')
      navigate('/login', { signupEmail: (result as { email: string }).email })
    } catch {
      setFormError(genericError)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const errorFor = (field: Field) => errors[field] && <span className="auth-field-error" id={`${field}-error`}>{errors[field]}</span>
  return (
    <main className="auth-main" id="main">
      <section className="auth-card" aria-labelledby="signup-title">
        <a className="auth-wordmark" href="/" onClick={(event) => { event.preventDefault(); navigate('/') }}>Petever</a>
        <span className="auth-overline">함께하는 첫걸음</span>
        <h1 id="signup-title">회원가입</h1>
        <p className="auth-description">소중한 생명과 이어지는 이야기를 시작해요.</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <label>이메일<input name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />{errorFor('email')}</label>
          <label>비밀번호<input name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} />{errorFor('password')}</label>
          <label>비밀번호 확인<input name="passwordConfirmation" type="password" autoComplete="new-password" aria-invalid={!!errors.passwordConfirmation} aria-describedby={errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined} />{errorFor('passwordConfirmation')}</label>
          <label>닉네임<input name="nickname" type="text" autoComplete="nickname" aria-invalid={!!errors.nickname} aria-describedby={errors.nickname ? 'nickname-error' : undefined} />{errorFor('nickname')}</label>
          <label>전화번호 (선택)<input name="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : undefined} />{errorFor('phone')}</label>
          {formError && <p className="auth-form-error" role="alert">{formError}</p>}
          <button type="submit" className="auth-primary" disabled={pending}>{pending ? '가입 중…' : '회원가입'}</button>
        </form>
        <p className="auth-bottom">이미 계정이 있나요? <a href="/login" onClick={(event) => { event.preventDefault(); navigate('/login') }}>로그인</a></p>
      </section>
    </main>
  )
}
