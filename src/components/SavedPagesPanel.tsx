import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

type SavedPagesPanelProps = {
  title?: string
  showCollages?: boolean
  variant?: 'grid' | 'strip'
}

export function SavedPagesPanel({
  title = 'Library',
  showCollages = false,
  variant = 'grid',
}: SavedPagesPanelProps) {
  const allPages = useAppStore((state) => state.pages)
  const pages = useMemo(
    () =>
      showCollages
        ? allPages.filter((page) => page.isCollage)
        : allPages.filter((page) => !page.isCollage),
    [allPages, showCollages],
  )
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)
  const sourceImageName = useAppStore((state) => state.editor.sourceImageName)
  const loadPageIntoEditor = useAppStore((state) => state.loadPageIntoEditor)
  const deletePage = useAppStore((state) => state.deletePage)
  const renamePage = useAppStore((state) => state.renamePage)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const isActivePage = (page: (typeof pages)[number]) =>
    !page.isCollage &&
    page.sourceImageDataUrl === sourceImageDataUrl &&
    page.name === sourceImageName

  const startRename = (pageId: string, currentName: string) => {
    setRenamingId(pageId)
    setRenameValue(currentName)
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const submitRename = (pageId: string) => {
    renamePage(pageId, renameValue)
    cancelRename()
  }

  if (pages.length === 0) {
    if (variant === 'strip') return null
    return (
      <section className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        No saved pages yet.
      </section>
    )
  }

  if (variant === 'strip') {
    return (
      <div className="shrink-0 rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {title} ({pages.length})
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className="text-[11px] text-rose-400 hover:text-rose-300"
          >
            All
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {pages.map((page) => {
            const active = isActivePage(page)
            return (
              <div
                key={page.id}
                className={`w-28 shrink-0 overflow-hidden rounded-md border ${
                  active ? 'border-rose-400' : 'border-zinc-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => !page.isCollage && loadPageIntoEditor(page.id)}
                  className="block w-full"
                >
                  <img
                    src={page.thumbnailDataUrl}
                    alt={page.name}
                    className="aspect-video w-full bg-black object-cover"
                  />
                </button>
                {renamingId === page.id && page.isCollage ? (
                  <form
                    className="flex gap-0.5 p-1"
                    onSubmit={(event) => {
                      event.preventDefault()
                      submitRename(page.id)
                    }}
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-200"
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-700 px-1 text-[10px] text-white"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="rounded bg-zinc-800 px-1 text-[10px]"
                    >
                      ×
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1 p-1">
                    <p className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">{page.name}</p>
                    {page.isCollage && (
                      <button
                        type="button"
                        onClick={() => startRename(page.id, page.name)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300"
                        title="Rename"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePage(page.id)}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">
          {title} <span className="text-zinc-500">({pages.length})</span>
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => {
          const active = isActivePage(page)
          const isRenaming = renamingId === page.id

          return (
            <article
              key={page.id}
              className={`overflow-hidden rounded-lg border bg-zinc-950/50 ${
                active ? 'border-rose-400' : 'border-zinc-800'
              }`}
            >
              <div className="relative aspect-video bg-black">
                <img
                  src={page.thumbnailDataUrl}
                  alt={page.name}
                  className="h-full w-full object-contain"
                />
                {active && (
                  <span className="absolute left-2 top-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                    Active
                  </span>
                )}
              </div>
              <div className="space-y-2 p-2">
                {isRenaming ? (
                  <form
                    className="flex gap-1"
                    onSubmit={(event) => {
                      event.preventDefault()
                      submitRename(page.id)
                    }}
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p className="truncate text-xs font-medium text-zinc-300">{page.name}</p>
                )}

                <div className="flex gap-2">
                  {!page.isCollage && (
                    <button
                      type="button"
                      onClick={() => loadPageIntoEditor(page.id)}
                      className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                    >
                      Open
                    </button>
                  )}
                  {page.isCollage && !isRenaming && (
                    <button
                      type="button"
                      onClick={() => startRename(page.id, page.name)}
                      className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
                    >
                      Rename
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deletePage(page.id)}
                    className="rounded bg-red-950/50 px-2 py-1 text-xs text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
