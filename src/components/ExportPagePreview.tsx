import { useEffect, useState } from 'react'
import type { AppSettings, Page } from '../types'
import { renderPageForExport } from '../utils/export'

type ExportPagePreviewProps = {
  page: Page
  settings: AppSettings
  allPages: Page[]
  className?: string
}

export function ExportPagePreview({ page, settings, allPages, className = '' }: ExportPagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsRendering(true)

    void renderPageForExport(page, settings, allPages)
      .then((dataUrl) => {
        if (!cancelled) setPreviewUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(page.thumbnailDataUrl)
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, settings, allPages])

  if (isRendering && !previewUrl) {
    return (
      <div
        className={`flex h-36 w-full items-center justify-center bg-zinc-950 text-xs text-zinc-500 ${className}`}
      >
        Rendering…
      </div>
    )
  }

  return (
    <img
      src={previewUrl ?? page.thumbnailDataUrl}
      alt={page.name}
      className={`h-36 w-full object-cover ${className}`}
    />
  )
}
