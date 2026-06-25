import { useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

type BackgroundControlsProps = {
  compact?: boolean
}

export function BackgroundControls({ compact = false }: BackgroundControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const uploadBackgroundImage = useAppStore((state) => state.uploadBackgroundImage)
  const clearBackgroundImage = useAppStore((state) => state.clearBackgroundImage)

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadBackgroundImage(file)
    event.target.value = ''
  }

  return (
    <section
      className={`space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 ${
        compact ? 'p-3' : 'space-y-4 p-4'
      }`}
    >
      <div>
        <h2 className={compact ? 'text-sm font-semibold text-zinc-200' : 'text-lg font-semibold'}>
          Background
        </h2>
        {!compact && (
          <p className="mt-1 text-sm text-zinc-400">
            One shared background for all pages and collages. The editor uses a placeholder;
            collage preview and export apply this background.
          </p>
        )}
        {compact && (
          <p className="mt-0.5 text-xs text-zinc-500">
            Shared across all panels — preview updates below.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.useSolidBackground}
          onChange={(e) => updateSettings({ useSolidBackground: e.target.checked })}
        />
        Use solid color background
      </label>
      <label className="block text-sm">
        Background color
        <input
          type="color"
          value={settings.backgroundColor}
          onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
          className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
        />
      </label>
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
