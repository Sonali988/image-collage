import type { Page } from '../types'

export function isVideoPage(page: Page): boolean {
  return page.kind === 'video' || Boolean(page.sourceVideoId)
}

export function isImageDocumentPage(page: Page): boolean {
  return !page.isCollage && !isVideoPage(page)
}
