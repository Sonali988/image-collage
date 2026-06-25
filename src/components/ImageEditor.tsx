import { useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CanvasPreview } from './CanvasPreview'
import { OverlayControls } from './OverlayControls'
import { OverlayTintPicker } from './OverlayTintPicker'
import { Panel } from './Panel'
import { SavedPagesPanel } from './SavedPagesPanel'

export function ImageEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)
  const sourceImageName = useAppStore((state) => state.editor.sourceImageName)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const uploadSourceImage = useAppStore((state) => state.uploadSourceImage)
  const saveCurrentPage = useAppStore((state) => state.saveCurrentPage)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadSourceImage(file)
    event.target.value = ''
    setSaveMessage(null)
  }

  const handleSave = async () => {
    await saveCurrentPage()
    setSaveMessage('Saved')
    window.setTimeout(() => setSaveMessage(null), 2500)
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto pr-0.5 lg:max-h-none">
        <Panel title="Document">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => void handleUpload(event)}
            className="hidden"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-md bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-400"
            >
              Upload
            </button>
            <button
              type="button"
              disabled={!sourceImageDataUrl}
              onClick={() => void handleSave()}
              className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-40"
            >
              Save
            </button>
          </div>
          {sourceImageName && (
            <p className="mt-2 truncate text-xs text-zinc-500">{sourceImageName}</p>
          )}
          {saveMessage && <p className="mt-1 text-xs text-emerald-400">{saveMessage}</p>}
        </Panel>

        {sourceImageDataUrl && (
          <Panel title="Look">
            <OverlayTintPicker compact />
            <label className="mt-3 block text-xs text-zinc-500">
              Blur {settings.blurAmount}px
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={settings.blurAmount}
                onChange={(event) =>
                  updateSettings({ blurAmount: Number(event.target.value) })
                }
                className="mt-1 w-full accent-rose-400"
              />
            </label>
            <label className="mt-3 block text-xs text-zinc-500">
              Contrast {Math.round((settings.overlayContrast ?? 1) * 100)}%
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.overlayContrast ?? 1}
                onChange={(event) =>
                  updateSettings({ overlayContrast: Number(event.target.value) })
                }
                className="mt-1 w-full accent-amber-400"
              />
            </label>
            <label className="mt-3 block text-xs text-zinc-500">
              Sharpness {Math.round((settings.overlaySharpness ?? 0) * 100)}%
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={settings.overlaySharpness ?? 0}
                onChange={(event) =>
                  updateSettings({ overlaySharpness: Number(event.target.value) })
                }
                className="mt-1 w-full accent-emerald-400"
              />
            </label>
          </Panel>
        )}

        <Panel title="Markers & Crops">
          <OverlayControls />
        </Panel>
      </aside>

      <section className="flex min-h-0 flex-col gap-2">
        <CanvasPreview className="min-h-[240px] flex-1" />
        <SavedPagesPanel title="Library" variant="strip" />
      </section>
    </div>
  )
}
