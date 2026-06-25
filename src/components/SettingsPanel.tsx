import { useAppStore } from '../store/useAppStore'
import { OverlayTintPicker } from './OverlayTintPicker'

export function SettingsPanel() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  const updateMarkerDetection = (key: string, value: number) => {
    updateSettings({
      markerDetection: {
        ...settings.markerDetection,
        [key]: value,
      },
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-lg font-semibold">Canvas dimensions</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Background width
            <input
              type="number"
              value={settings.backgroundWidth}
              onChange={(e) => updateSettings({ backgroundWidth: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Background height
            <input
              type="number"
              value={settings.backgroundHeight}
              onChange={(e) => updateSettings({ backgroundHeight: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Content width
            <input
              type="number"
              value={settings.contentWidth}
              onChange={(e) => updateSettings({ contentWidth: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Content height
            <input
              type="number"
              value={settings.contentHeight}
              onChange={(e) => updateSettings({ contentHeight: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-lg font-semibold">Effects</h2>
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-300">Overlay tint</h3>
          <OverlayTintPicker />
        </div>
        <label className="block text-sm">
          Default zoom factor ({settings.defaultZoomFactor}×)
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={settings.defaultZoomFactor}
            onChange={(e) => updateSettings({ defaultZoomFactor: Number(e.target.value) })}
            className="mt-2 w-full accent-rose-400"
          />
        </label>
        <label className="block text-sm">
          Blur amount ({settings.blurAmount}px)
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={settings.blurAmount}
            onChange={(e) => updateSettings({ blurAmount: Number(e.target.value) })}
            className="mt-2 w-full accent-rose-400"
          />
        </label>
        <label className="block text-sm">
          Overlay border width
          <input
            type="number"
            min={0}
            max={10}
            value={settings.overlayBorderWidth}
            onChange={(e) => updateSettings({ overlayBorderWidth: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-lg font-semibold">Green marker detection</h2>
        <label className="block text-sm">
          Hue min ({settings.markerDetection.hueMin}°)
          <input
            type="range"
            min={0}
            max={180}
            value={settings.markerDetection.hueMin}
            onChange={(e) => updateMarkerDetection('hueMin', Number(e.target.value))}
            className="mt-2 w-full accent-emerald-400"
          />
        </label>
        <label className="block text-sm">
          Hue max ({settings.markerDetection.hueMax}°)
          <input
            type="range"
            min={0}
            max={360}
            value={settings.markerDetection.hueMax}
            onChange={(e) => updateMarkerDetection('hueMax', Number(e.target.value))}
            className="mt-2 w-full accent-emerald-400"
          />
        </label>
        <label className="block text-sm">
          Saturation min ({settings.markerDetection.satMin.toFixed(2)})
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.markerDetection.satMin}
            onChange={(e) => updateMarkerDetection('satMin', Number(e.target.value))}
            className="mt-2 w-full accent-emerald-400"
          />
        </label>
        <label className="block text-sm">
          Min marker area ({settings.markerDetection.minMarkerArea}px²)
          <input
            type="number"
            min={50}
            value={settings.markerDetection.minMarkerArea}
            onChange={(e) => updateMarkerDetection('minMarkerArea', Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Marker inset ({settings.markerDetection.markerInset}px)
          <input
            type="number"
            min={0}
            max={20}
            value={settings.markerDetection.markerInset}
            onChange={(e) => updateMarkerDetection('markerInset', Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
      </section>
    </div>
  )
}
