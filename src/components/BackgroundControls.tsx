import { useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export function BackgroundControls() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settings = useAppStore((state) => state.settings)
  const uploadBackgroundImage = useAppStore((state) => state.uploadBackgroundImage)
  const clearBackgroundImage = useAppStore((state) => state.clearBackgroundImage)

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadBackgroundImage(file)
    event.target.value = ''
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div>
        <h2 className="text-lg font-semibold">Background</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Upload an optional background image for export. Without an image, the default solid
          color is used.
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => void handleBackgroundUpload(event)}
        className="hidden"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
        >
          Upload background image
        </button>
        {settings.backgroundImageDataUrl && (
          <button
            type="button"
            onClick={clearBackgroundImage}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  )
}
