export type Account = { id: number; email: string; nickname: string }

export async function csrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf')
  if (!response.ok) throw new Error('CSRF request failed')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || typeof (data as { token?: unknown }).token !== 'string') {
    throw new Error('Invalid CSRF response')
  }
  return (data as { token: string }).token
}

export function isAccount(data: unknown): data is Account {
  if (!data || typeof data !== 'object') return false
  const account = data as Partial<Account>
  return typeof account.id === 'number' && typeof account.email === 'string' && typeof account.nickname === 'string'
}