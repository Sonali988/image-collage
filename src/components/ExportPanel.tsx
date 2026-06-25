import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import {
  downloadPagePng,
  downloadSelectedPagesAsPngs,
  downloadSelectedPagesAsZip,
} from '../utils/export'
import { BackgroundControls } from './BackgroundControls'
import { ExportPagePreview } from './ExportPagePreview'

export function ExportPanel() {
  const pages = useAppStore((state) => state.pages)
  const settings = useAppStore((state) => state.settings)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedCount = selectedIds.length
  const allSelected = pages.length > 0 && selectedCount === pages.length

  const runExport = async (action: () => Promise<void>) => {
    setIsExporting(true)
    try {
      await action()
    } finally {
      setIsExporting(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((pageId) => pageId !== id) : [...current, id],
    )
  }

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : pages.map((page) => page.id))
  }

  if (pages.length === 0) {
    return (
      <div className="space-y-6">
        <BackgroundControls />
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
          No pages to export yet.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackgroundControls />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Export</h2>
            <p className="text-sm text-zinc-400">
              {selectedCount} of {pages.length} selected ·{' '}
              {settings.backgroundWidth}×{settings.backgroundHeight}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isExporting || selectedCount === 0}
            onClick={() =>
              void runExport(() => downloadSelectedPagesAsPngs(pages, selectedIds, settings))
            }
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download selected as PNGs
          </button>
          <button
            type="button"
            disabled={isExporting || selectedCount === 0}
            onClick={() =>
              void runExport(() => downloadSelectedPagesAsZip(pages, selectedIds, settings))
            }
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm enabled:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download selected as ZIP
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => {
          const selected = selectedIds.includes(page.id)

          return (
            <article
              key={page.id}
              className={`overflow-hidden rounded-xl border bg-zinc-900/40 transition ${
                selected
                  ? 'border-rose-400 ring-1 ring-rose-400/50'
                  : 'border-zinc-800'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSelection(page.id)}
                className="relative block w-full text-left"
              >
                <ExportPagePreview page={page} settings={settings} allPages={pages} />
                <span
                  className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border text-[10px] font-semibold ${
                    selected
                      ? 'border-rose-400 bg-rose-500 text-white'
                      : 'border-zinc-600 bg-black/60 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </button>
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
                  onClick={() => void runExport(() => downloadPagePng(page, settings, pages))}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs enabled:hover:bg-zinc-700 disabled:opacity-40"
                >
                  PNG
                </button>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
