import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { downloadAllPagesAsPngs, downloadAllPagesAsZip, downloadPagePng } from '../utils/export'

export function ExportPanel() {
  const pages = useAppStore((state) => state.pages)
  const settings = useAppStore((state) => state.settings)
  const [isExporting, setIsExporting] = useState(false)

  const runExport = async (action: () => Promise<void>) => {
    setIsExporting(true)
    try {
      await action()
    } finally {
      setIsExporting(false)
    }
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
        No pages to export yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-2 text-lg font-semibold">Bulk export</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Export all {pages.length} saved pages at full {settings.backgroundWidth}×{settings.backgroundHeight} resolution.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void runExport(() => downloadAllPagesAsZip(pages))}
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-rose-400 disabled:opacity-40"
          >
            Download all as ZIP
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void runExport(() => downloadAllPagesAsPngs(pages))}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm enabled:hover:bg-zinc-700 disabled:opacity-40"
          >
            Download all as PNGs
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <article
            key={page.id}
            className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
          >
            <img
              src={page.thumbnailDataUrl}
              alt={page.name}
              className="h-36 w-full object-cover"
            />
            <div className="flex items-center justify-between gap-2 p-4">
              <div>
                <h3 className="font-medium">{page.name}</h3>
                <p className="text-xs text-zinc-500">
                  {page.isCollage ? 'Collage' : 'Page'}
                </p>
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void runExport(() => downloadPagePng(page))}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs enabled:hover:bg-zinc-700 disabled:opacity-40"
              >
                PNG
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
