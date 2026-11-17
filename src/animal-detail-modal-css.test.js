import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const modalCss = readFileSync('src/animal-detail-modal.css', 'utf8')

describe('animal detail modal map styles', () => {
  it('does not size Kakao map tile images as animal photos', () => {
    expect(modalCss).not.toMatch(/\.animal-dialog\s+img\s*\{/)
    expect(modalCss).toContain('.animal-dialog__main-photo > img, .animal-dialog__thumbs img')
    expect(modalCss).toContain('display: block; width: 100%;')
  })
})
