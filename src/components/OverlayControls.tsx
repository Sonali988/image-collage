import type { MagnifierOverlay } from '../types'
import { useAppStore } from '../store/useAppStore'

function OverlayCard({
  overlay,
  maxOffsetX,
  maxOffsetY,
  showRectSliders,
}: {
  overlay: MagnifierOverlay
  maxOffsetX: number
  maxOffsetY: number
  showRectSliders?: boolean
}) {
  const updateOverlayScale = useAppStore((state) => state.updateOverlayScale)
  const updateOverlayOffset = useAppStore((state) => state.updateOverlayOffset)
  const updateOverlayRect = useAppStore((state) => state.updateOverlayRect)
  const removeOverlay = useAppStore((state) => state.removeOverlay)

  return (
    <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{overlay.label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">{overlay.userScale.toFixed(2)}×</span>
          <button
            type="button"
            onClick={() => removeOverlay(overlay.id)}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </div>

      {showRectSliders && (
        <>
          <label className="mb-1.5 block text-[10px] text-zinc-500">
            Width {Math.round(overlay.rect.w * 100)}%
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.005}
              value={overlay.rect.w}
              onChange={(event) => {
                const w = Number(event.target.value)
                const maxW = 1 - overlay.rect.x
                updateOverlayRect(overlay.id, {
                  ...overlay.rect,
                  w: Math.min(w, maxW),
                })
              }}
              className="mt-0.5 w-full accent-violet-400"
            />
          </label>
          <label className="mb-1.5 block text-[10px] text-zinc-500">
            Height {Math.round(overlay.rect.h * 100)}%
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.005}
              value={overlay.rect.h}
              onChange={(event) => {
                const h = Number(event.target.value)
                const maxH = 1 - overlay.rect.y
                updateOverlayRect(overlay.id, {
                  ...overlay.rect,
                  h: Math.min(h, maxH),
                })
              }}
              className="mt-0.5 w-full accent-violet-400"
            />
          </label>
        </>
      )}

      <label className="mb-1.5 block text-[10px] text-zinc-500">
        Zoom
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={overlay.userScale}
          onChange={(event) => updateOverlayScale(overlay.id, Number(event.target.value))}
          className="mt-0.5 w-full accent-rose-400"
        />
      </label>

      <label className="mb-1.5 block text-[10px] text-zinc-500">
        X {overlay.offsetX ?? 0}
        <input
          type="range"
          min={-maxOffsetX}
          max={maxOffsetX}
          step={1}
          value={overlay.offsetX ?? 0}
          onChange={(event) =>
            updateOverlayOffset(
              overlay.id,
              Number(event.target.value),
              overlay.offsetY ?? 0,
            )
          }
          className="mt-0.5 w-full accent-sky-400"
        />
      </label>

      <label className="block text-[10px] text-zinc-500">
        Y {overlay.offsetY ?? 0}
        <input
          type="range"
          min={-maxOffsetY}
          max={maxOffsetY}
          step={1}
          value={overlay.offsetY ?? 0}
          onChange={(event) =>
            updateOverlayOffset(
              overlay.id,
              overlay.offsetX ?? 0,
              Number(event.target.value),
            )
          }
          className="mt-0.5 w-full accent-sky-400"
        />
      </label>
    </div>
  )
}

export function OverlayControls() {
  const overlays = useAppStore((state) => state.editor.overlays)
  const settings = useAppStore((state) => state.settings)
  const isDetecting = useAppStore((state) => state.editor.isDetecting)
  const isCropMode = useAppStore((state) => state.editor.isCropMode)
  const detectionError = useAppStore((state) => state.editor.detectionError)
  const resetOverlayAdjustments = useAppStore((state) => state.resetOverlayAdjustments)
  const redetectMarkers = useAppStore((state) => state.redetectMarkers)
  const setCropMode = useAppStore((state) => state.setCropMode)
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)

  const maxOffsetX = Math.round(settings.contentWidth / 2)
  const maxOffsetY = Math.round(settings.contentHeight / 2)

  const markers = overlays.filter((overlay) => overlay.type === 'marker')
  const crops = overlays.filter((overlay) => overlay.type === 'crop')

  if (isDetecting) {
    return (
      <p className="text-sm text-zinc-400">
        Detecting green markers… This may take a few seconds on large images.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={!sourceImageDataUrl || isCropMode}
        onClick={() => setCropMode(true)}
        className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-sky-500 disabled:opacity-40"
      >
        {isCropMode ? 'Drag on preview…' : 'Add crop zone'}
      </button>

      {isCropMode && (
        <button
          type="button"
          onClick={() => setCropMode(false)}
          className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
        >
          Cancel crop
        </button>
      )}

      {detectionError && markers.length === 0 && crops.length === 0 && (
        <p className="text-sm text-amber-400">{detectionError}</p>
      )}

      {markers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              {markers.length} marker{markers.length === 1 ? '' : 's'}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={resetOverlayAdjustments}
                className="rounded bg-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-700"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void redetectMarkers()}
                className="rounded bg-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-700"
              >
                Re-detect
              </button>
            </div>
          </div>
          {markers.map((overlay) => (
            <OverlayCard
              key={overlay.id}
              overlay={overlay}
              maxOffsetX={maxOffsetX}
              maxOffsetY={maxOffsetY}
            />
          ))}
        </div>
      )}

      {markers.length === 0 && (
        <button
          type="button"
          onClick={() => void redetectMarkers()}
          className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
        >
          Re-detect markers
        </button>
      )}

      {crops.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-zinc-500">
            {crops.length} crop{crops.length === 1 ? '' : 's'}
          </span>
          {crops.map((overlay) => (
            <OverlayCard
              key={overlay.id}
              overlay={overlay}
              maxOffsetX={maxOffsetX}
              maxOffsetY={maxOffsetY}
              showRectSliders
            />
          ))}
        </div>
      )}
    </div>
  )
}
