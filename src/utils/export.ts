import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { Page } from '../types'
import { renderPageToDataUrl } from './canvasRenderer'

function getReportsZipFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `reports-${year}-${month}-${day}.zip`
}

export async function downloadPagePng(page: Page, filename?: string) {
  const dataUrl = await renderPageToDataUrl(
    page.settings,
    page.sourceImageDataUrl,
    page.overlays,
  )
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  saveAs(blob, filename ?? `${page.name}.png`)
}

export async function downloadAllPagesAsPngs(pages: Page[]) {
  for (const page of pages) {
    await downloadPagePng(page)
  }
}

export async function downloadAllPagesAsZip(pages: Page[], zipName?: string) {
  const zip = new JSZip()

  for (const page of pages) {
    const dataUrl = page.isCollage
      ? page.thumbnailDataUrl
      : await renderPageToDataUrl(page.settings, page.sourceImageDataUrl, page.overlays)

    const response = await fetch(dataUrl)
    const blob = await response.blob()
    zip.file(`${page.name}.png`, blob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, zipName ?? getReportsZipFilename())
}
