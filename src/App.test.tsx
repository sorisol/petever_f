import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('start page', () => {
  it('shows the Petever application status', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Petever' })).toBeTruthy()
    expect(screen.getByText('프로젝트가 실행 중입니다.')).toBeTruthy()
  })
})
