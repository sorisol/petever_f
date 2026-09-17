import { describe, expect, it } from 'vitest'
import dashboard from '../designs/home-split/concept-03-dashboard.html?raw'
import editorial from '../designs/home-split/concept-01-editorial.html?raw'
import immersive from '../designs/home-split/concept-02-immersive.html?raw'
import comparison from '../designs/home-split/index.html?raw'

const documents = [
  ['index.html', comparison],
  ['concept-01-editorial.html', editorial],
  ['concept-02-immersive.html', immersive],
  ['concept-03-dashboard.html', dashboard],
] as const
const designModules = import.meta.glob('../designs/home-split/*', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const localFiles = new Set(
  Object.keys(designModules).map((path) => path.split('/').at(-1)),
)

describe('home split design prototypes', () => {
  it('keeps the approved dashboard copy and mixed-case presentation', () => {
    expect(dashboard).toContain('Every life, ever loved')
    expect(dashboard).toContain('다시 만나는 날까지,<br>곁을 지켜요.')
    expect(dashboard).toContain(
      '보호 중인 동물에게는 새로운 가족을, 길을 잃은 동물에게는 돌아갈 길을 연결합니다.',
    )
    const page = new DOMParser().parseFromString(dashboard, 'text/html')
    const overline = page.querySelector('.overline')
    expect(overline?.textContent).toBe('Every life, ever loved')
    expect(overline?.getAttribute('lang')).toBe('en')
    expect(overline?.getAttribute('style')).toContain('text-transform:none')
  })

  it('only references local files that exist', () => {
    for (const [htmlFile, html] of documents) {
      const references = html.matchAll(/\b(?:href|src)="([^"]+)"/g)

      for (const [, reference] of references) {
        if (
          reference.startsWith('#') ||
          reference.startsWith('http://') ||
          reference.startsWith('https://')
        ) {
          continue
        }

        expect(
          localFiles.has(reference),
          `${htmlFile} references missing file ${reference}`,
        ).toBe(true)
      }
    }
  })
})
