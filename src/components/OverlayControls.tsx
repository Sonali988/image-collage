import { useEffect, useRef, useState } from 'react'
import type { MagnifierOverlay } from '../types'
import { useAppStore } from '../store/useAppStore'

function OverlayCard({
  overlay,
  maxOffsetX,
  maxOffsetY,
  showRectSliders,
  selected,
  onSelect,
  onCopy,
}: {
  overlay: MagnifierOverlay
  maxOffsetX: number
  maxOffsetY: number
  showRectSliders?: boolean
  selected: boolean
  onSelect: () => void
  onCopy?: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const updateOverlayScale = useAppStore((state) => state.updateOverlayScale)
  const updateOverlayOffset = useAppStore((state) => state.updateOverlayOffset)
  const updateOverlayRect = useAppStore((state) => state.updateOverlayRect)
  const removeOverlay = useAppStore((state) => state.removeOverlay)

  useEffect(() => {
    if (!selected || !cardRef.current) return
    cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`rounded-md border p-2 transition ${
        selected
          ? 'border-rose-400 bg-rose-500/10 ring-1 ring-rose-400/40'
          : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${selected ? 'text-rose-200' : ''}`}>
          {overlay.label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">{overlay.userScale.toFixed(2)}×</span>
          {selected && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCopy?.()
              }}
              className="text-[10px] text-sky-400 hover:text-sky-300"
            >
              Copy
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              removeOverlay(overlay.id)
            }}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </div>

      {selected && (
        <p className="mb-1.5 text-[10px] text-rose-300/80">Selected · adjust below</p>
      )}

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
              onClick={(event) => event.stopPropagation()}
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
              onClick={(event) => event.stopPropagation()}
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
          onClick={(event) => event.stopPropagation()}
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
          onClick={(event) => event.stopPropagation()}
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
          onClick={(event) => event.stopPropagation()}
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
  const selectedOverlayId = useAppStore((state) => state.editor.selectedOverlayId)
  const overlayClipboard = useAppStore((state) => state.overlayClipboard)
  const settings = useAppStore((state) => state.settings)
  const isDetecting = useAppStore((state) => state.editor.isDetecting)
  const isCropMode = useAppStore((state) => state.editor.isCropMode)
  const isDocumentCropMode = useAppStore((state) => state.editor.isDocumentCropMode)
  const detectionError = useAppStore((state) => state.editor.detectionError)
  const resetOverlayAdjustments = useAppStore((state) => state.resetOverlayAdjustments)
  const redetectMarkers = useAppStore((state) => state.redetectMarkers)
  const setCropMode = useAppStore((state) => state.setCropMode)
  const setSelectedOverlayId = useAppStore((state) => state.setSelectedOverlayId)
  const copySelectedOverlay = useAppStore((state) => state.copySelectedOverlay)
  const pasteCopiedOverlay = useAppStore((state) => state.pasteCopiedOverlay)
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)

  const maxOffsetX = Math.round(settings.contentWidth / 2)
  const maxOffsetY = Math.round(settings.contentHeight / 2)

  const markers = overlays.filter((overlay) => overlay.type === 'marker')
  const crops = overlays.filter((overlay) => overlay.type === 'crop')
  const hasSelection = overlays.some((overlay) => overlay.id === selectedOverlayId)
  const clipboardLabel =
    overlayClipboard?.type === 'marker'
      ? 'Marker'
      : overlayClipboard?.type === 'crop'
        ? 'Crop'
        : 'Zone'
  const [pasteMessage, setPasteMessage] = useState<string | null>(null)

  const handlePaste = async () => {
    const pasted = await pasteCopiedOverlay()
    if (!pasted) return
    setPasteMessage('Saved as new page')
    window.setTimeout(() => setPasteMessage(null), 2500)
  }

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
        disabled={!sourceImageDataUrl || isCropMode || isDocumentCropMode}
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

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => copySelectedOverlay()}
          className="flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-xs enabled:hover:bg-zinc-700 disabled:opacity-40"
        >
          Copy zone
        </button>
        <button
          type="button"
          disabled={!overlayClipboard || !sourceImageDataUrl}
          onClick={() => void handlePaste()}
          className="flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-xs enabled:hover:bg-zinc-700 disabled:opacity-40"
        >
          Paste zone
        </button>
      </div>
      {overlayClipboard && (
        <p className="text-[10px] leading-snug text-zinc-500">
          {clipboardLabel} copied. Open another page and paste — saves as a new page.
        </p>
      )}
      {pasteMessage && (
        <p className="text-[10px] text-emerald-400">{pasteMessage}</p>
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
              selected={selectedOverlayId === overlay.id}
              onSelect={() => setSelectedOverlayId(overlay.id)}
              onCopy={() => copySelectedOverlay()}
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
              selected={selectedOverlayId === overlay.id}
              onSelect={() => setSelectedOverlayId(overlay.id)}
              onCopy={() => copySelectedOverlay()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
