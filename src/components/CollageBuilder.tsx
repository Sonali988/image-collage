import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CollagePreview } from './CollagePreview'
import {
  MAX_COLLAGE_IMAGE_SCALE,
  MAX_COLLAGE_PANELS,
  MIN_COLLAGE_IMAGE_SCALE,
  MIN_COLLAGE_PANELS,
} from '../config/collage'

export function CollageBuilder() {
  const allPages = useAppStore((state) => state.pages)
  const pages = useMemo(() => allPages.filter((page) => !page.isCollage), [allPages])
  const collageCount = useMemo(
    () => allPages.filter((page) => page.isCollage).length,
    [allPages],
  )
  const collageSelectedIds = useAppStore((state) => state.collageSelectedIds)
  const collageTitles = useAppStore((state) => state.collageTitles)
  const collageShowTitles = useAppStore((state) => state.collageShowTitles)
  const collageImageScales = useAppStore((state) => state.collageImageScales)
  const toggleCollageSelection = useAppStore((state) => state.toggleCollageSelection)
  const setCollageTitle = useAppStore((state) => state.setCollageTitle)
  const setCollageShowTitles = useAppStore((state) => state.setCollageShowTitles)
  const setCollageImageScale = useAppStore((state) => state.setCollageImageScale)
  const saveCollage = useAppStore((state) => state.saveCollage)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collageName, setCollageName] = useState('')
  const defaultCollageName = `Collage ${collageCount + 1}`

  const selectedCount = collageSelectedIds.length
  const canSave = selectedCount >= MIN_COLLAGE_PANELS
  const selectionFull = selectedCount >= MAX_COLLAGE_PANELS

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)
    try {
      await saveCollage(collageName.trim() || undefined)
      setCollageName('')
    } catch {
      setError('Could not create collage. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">Build collage</p>
              <p className="text-xs text-zinc-500">
                Select {MIN_COLLAGE_PANELS}–{MAX_COLLAGE_PANELS} pages · {selectedCount} selected
                {selectionFull ? ' (full)' : ''}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-2 sm:max-w-md">
              <label className="min-w-[140px] flex-1 text-xs text-zinc-500">
                Collage name
                <input
                  type="text"
                  value={collageName}
                  onChange={(event) => setCollageName(event.target.value)}
                  placeholder={defaultCollageName}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
                />
              </label>
              <button
                type="button"
                disabled={!canSave || isSaving}
                onClick={() => void handleSave()}
                className="shrink-0 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? 'Saving…' : 'Save collage'}
              </button>
            </div>
          </div>
        </div>

        {selectedCount > 0 && (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-200">Panel options</h2>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={collageShowTitles}
                  onChange={(event) => setCollageShowTitles(event.target.checked)}
                  className="rounded"
                />
                Titles
              </label>
            </div>

            {collageShowTitles && (
              <div
                className={`mb-3 grid gap-2 ${
                  selectedCount >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                }`}
              >
                {Array.from({ length: selectedCount }).map((_, index) => (
                  <label key={index} className="block text-xs text-zinc-500">
                    Panel {index + 1}
                    <input
                      type="text"
                      value={collageTitles[index] ?? ''}
                      onChange={(event) => setCollageTitle(index, event.target.value)}
                      placeholder={
                        index === 0 ? 'BEFORE' : index === 1 ? 'AFTER' : `Panel ${index + 1}`
                      }
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm uppercase tracking-wide text-zinc-200"
                    />
                  </label>
                ))}
              </div>
            )}

            <div
              className={`grid gap-2 ${
                selectedCount >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              }`}
            >
              {Array.from({ length: selectedCount }).map((_, index) => (
                <label key={`scale-${index}`} className="block text-xs text-zinc-500">
                  Panel {index + 1} size · {(collageImageScales[index] ?? 1).toFixed(2)}×
                  <input
                    type="range"
                    min={MIN_COLLAGE_IMAGE_SCALE}
                    max={MAX_COLLAGE_IMAGE_SCALE}
                    step={0.05}
                    value={collageImageScales[index] ?? 1}
                    onChange={(event) =>
                      setCollageImageScale(index, Number(event.target.value))
                    }
                    className="mt-1 w-full accent-rose-400"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="min-h-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Saved pages</h2>
            <span className="text-xs text-zinc-500">{pages.length} available</span>
          </div>

          {pages.length < MIN_COLLAGE_PANELS ? (
            <p className="rounded-md border border-dashed border-zinc-700 px-4 py-8 text-center text-xs text-zinc-500">
              Save at least {MIN_COLLAGE_PANELS} pages in the Editor first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {pages.map((page) => {
                const selected = collageSelectedIds.includes(page.id)
                const disabled = selectionFull && !selected

                return (
                  <button
                    key={page.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCollageSelection(page.id)}
                    className={`group overflow-hidden rounded-md border text-left transition ${
                      selected
                        ? 'border-rose-400 ring-1 ring-rose-400/50'
                        : disabled
                          ? 'cursor-not-allowed border-zinc-800/80 opacity-40'
                          : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <div className="relative h-20 bg-black sm:h-24">
                      <img
                        src={page.thumbnailDataUrl}
                        alt={page.name}
                        className="h-full w-full object-contain"
                      />
                      {selected && (
                        <span className="absolute right-1 top-1 rounded bg-rose-500 px-1 text-[9px] font-semibold text-white">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="truncate px-2 py-1.5 text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300">
                      {page.name}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {!canSave && pages.length >= MIN_COLLAGE_PANELS && (
          <p className="text-xs text-zinc-500">
            Select at least {MIN_COLLAGE_PANELS} pages to save a collage.
          </p>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <aside className="flex min-h-[min(42vh,360px)] shrink-0 flex-col lg:min-h-0 lg:w-[min(48%,680px)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Preview</h2>
          {canSave && (
            <span className="text-xs text-zinc-500">
              {selectedCount} panel{selectedCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <CollagePreview className="h-full" />
        </div>
      </aside>
    </div>
  )
}
