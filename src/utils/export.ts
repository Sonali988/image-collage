import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { AppSettings, Page } from '../types'
import {
  mergeBackgroundSettings,
  renderCollageFromPages,
  renderPageToDataUrl,
} from './canvasRenderer'

function getReportsZipFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `reports-${year}-${month}-${day}.zip`
}

export async function renderPageForExport(page: Page, globalSettings: AppSettings, allPages: Page[]) {
  if (page.isCollage && page.collagePanelPageIds?.length) {
    const panelPages = page.collagePanelPageIds
      .map((id) => allPages.find((item) => item.id === id && !item.isCollage))
      .filter((item): item is Page => Boolean(item))

    if (panelPages.length >= page.collagePanelPageIds.length) {
      return renderCollageFromPages(
        panelPages,
        globalSettings,
        page.collageRenderOptions ?? { titles: [] },
      )
    }
  }

  if (page.isCollage) {
    return page.thumbnailDataUrl
  }

  return renderPageToDataUrl(
    mergeBackgroundSettings(page.settings, globalSettings),
    page.sourceImageDataUrl,
    page.overlays,
    'image/png',
    undefined,
    { documentCropRect: page.documentCropRect ?? null },
  )
}

export async function downloadPagePng(
  page: Page,
  globalSettings: AppSettings,
  allPages: Page[] = [],
  filename?: string,
) {
  const dataUrl = await renderPageForExport(page, globalSettings, allPages)
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  saveAs(blob, filename ?? `${page.name}.png`)
}

export async function downloadSelectedPagesAsPngs(
  pages: Page[],
  selectedIds: string[],
  globalSettings: AppSettings,
) {
  const selected = pages.filter((page) => selectedIds.includes(page.id))
  for (const page of selected) {
    await downloadPagePng(page, globalSettings, pages)
  }
}

export async function downloadSelectedPagesAsZip(
  pages: Page[],
  selectedIds: string[],
  globalSettings: AppSettings,
  zipName?: string,
) {
  const selected = pages.filter((page) => selectedIds.includes(page.id))
  if (selected.length === 0) return

  const zip = new JSZip()

  for (const page of selected) {
    const dataUrl = await renderPageForExport(page, globalSettings, pages)
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    zip.file(`${page.name}.png`, blob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, zipName ?? getReportsZipFilename())
}
