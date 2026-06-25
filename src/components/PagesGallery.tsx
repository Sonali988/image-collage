import { useAppStore } from '../store/useAppStore'
import { SavedPagesPanel } from './SavedPagesPanel'

export function PagesGallery() {
  const pageCount = useAppStore((state) => state.pages.length)
  const collageCount = useAppStore((state) =>
    state.pages.reduce((count, page) => count + (page.isCollage ? 1 : 0), 0),
  )

  if (pageCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-12 text-center">
        <h2 className="text-lg font-semibold text-zinc-200">No saved pages yet</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Upload a document in the Editor, then click Save page. Saved pages also appear
          below the preview in the Editor tab.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SavedPagesPanel title="Documents" />

      {collageCount > 0 && (
        <SavedPagesPanel title="Collages" showCollages />
      )}
    </div>
  )
}
