const params = new URLSearchParams(location.search)
const isPreview = params.get('preview') === '1'
const imageCount = ['0', '1', '3'].includes(params.get('images')) ? Number(params.get('images')) : 3
const isMissing = params.get('missing') === '1'
const isLong = params.get('long') === '1'
const backdrop = document.querySelector('.backdrop')
const dialog = document.querySelector('.modal')
const closeButton = document.querySelector('.close')
const reopenButton = document.querySelector('.reopen')
const pageShell = document.querySelector('.page-shell')
const mainImage = document.querySelector('.main-photo')
const galleryMain = document.querySelector('.gallery-main')
const placeholder = document.querySelector('.image-placeholder')
const counter = document.querySelector('.photo-index')
const thumbs = [...document.querySelectorAll('.thumb')]
let openTrigger = null
let visibleThumbs = []

function setBackground(src = '') {
  galleryMain.style.setProperty('--gallery-image', src ? `url(${src})` : 'none')
}

function showPlaceholder(message = '등록된 사진이 없습니다') {
  mainImage.hidden = true
  placeholder.hidden = false
  placeholder.querySelector('strong').textContent = message
  setBackground()
}

function updateAssetChips() {
  const labels = ['대표 사진', '추가 사진', '행사 안내 이미지']
  document.querySelectorAll('.asset-chip').forEach((chip, index) => {
    chip.textContent = `${labels[index]} ${index < imageCount ? '있음' : '없음'}`
  })
}

function updateCounter(index = 0) {
  const total = visibleThumbs.length
  counter.textContent = total ? `${index + 1} / ${total} · ${visibleThumbs[index].dataset.label}` : '0 / 0 · 사진 없음'
}

function selectImage(button) {
  visibleThumbs.forEach((thumb) => {
    const selected = thumb === button
    thumb.setAttribute('aria-pressed', String(selected))
  })
  mainImage.hidden = false
  placeholder.hidden = true
  mainImage.src = button.dataset.src
  mainImage.alt = button.dataset.alt
  setBackground(button.dataset.src)
  updateCounter(visibleThumbs.indexOf(button))
}

function configureGallery() {
  visibleThumbs = thumbs.slice(0, imageCount)
  thumbs.forEach((thumb, index) => { thumb.hidden = index >= imageCount })
  document.querySelectorAll('.thumbs, .filmstrip').forEach((list) => { list.hidden = imageCount < 2 })
  dialog.dataset.imageCount = String(imageCount)
  updateAssetChips()
  if (!imageCount) {
    showPlaceholder()
    updateCounter()
    return
  }
  selectImage(visibleThumbs[0])
}

function setPageInert(inert) {
  pageShell.inert = inert
  if (inert) pageShell.setAttribute('aria-hidden', 'true')
  else pageShell.removeAttribute('aria-hidden')
}

function openModal(trigger = document.activeElement) {
  openTrigger = trigger
  backdrop.hidden = false
  setPageInert(true)
  if (!isPreview) {
    document.body.style.overflow = 'hidden'
    closeButton.focus()
  }
}

function closeModal() {
  backdrop.hidden = true
  setPageInert(false)
  document.body.style.overflow = ''
  if (!isPreview) (openTrigger || reopenButton).focus()
}

closeButton.addEventListener('click', closeModal)
reopenButton.addEventListener('click', () => openModal(reopenButton))
backdrop.addEventListener('click', (event) => {
  if (event.target === backdrop) closeModal()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !backdrop.hidden) closeModal()
  if (event.key !== 'Tab' || backdrop.hidden) return
  const focusable = [...dialog.querySelectorAll('button:not([hidden]), a[href], summary, [tabindex]')]
    .filter((element) => element.tabIndex !== -1 && element.getClientRects().length)
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
})

document.querySelectorAll('.card').forEach((card) => card.addEventListener('click', () => openModal(card)))
thumbs.forEach((button) => {
  button.addEventListener('click', () => selectImage(button))
  button.addEventListener('keydown', (event) => {
    const index = visibleThumbs.indexOf(button)
    const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = visibleThumbs[(index + delta + visibleThumbs.length) % visibleThumbs.length]
    next.focus()
    selectImage(next)
  })
})
mainImage.addEventListener('error', () => {
  showPlaceholder('사진을 불러오지 못했습니다')
  counter.textContent = '사진을 불러오지 못했습니다'
})

document.querySelectorAll('.scenario a').forEach((link) => {
  const next = new URLSearchParams(link.dataset.query)
  if (isPreview) next.set('preview', '1')
  link.href = `?${next}`
})
if (isMissing) document.querySelectorAll('[data-optional]').forEach((value) => { value.textContent = '정보 없음' })
if (isLong) {
  document.querySelectorAll('[data-long]').forEach((value) => { value.textContent = value.dataset.long })
  document.body.classList.add('long-data')
}

configureGallery()
setPageInert(true)
if (!isPreview) {
  document.body.style.overflow = 'hidden'
  closeButton.focus()
}
