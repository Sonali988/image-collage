import { useEffect, useRef, useState } from 'react'
import {
  applyOverlayColorOption,
  DEFAULT_OVERLAY_TINT_OPACITY,
  getOverlayColorLabel,
  getOverlaySwatchStyle,
  isPaletteColorSelected,
  isTransparentOverlayTint,
  MAX_OVERLAY_TINT_OPACITY,
  MIN_OVERLAY_TINT_OPACITY,
  OVERLAY_COLOR_PALETTE,
  type OverlayColorOption,
} from '../config/overlayTintColors'
import type { OverlayTintPreset } from '../types'
import { useAppStore } from '../store/useAppStore'

type OverlayTintPickerProps = {
  compact?: boolean
}

function PaletteSwatch({
  option,
  selected,
  onSelect,
}: {
  option: OverlayColorOption
  selected: boolean
  onSelect: (option: OverlayColorOption) => void
}) {
  const isTransparent = option.id === 'transparent'

  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`h-7 w-7 rounded-md border transition ${
        selected
          ? 'border-white ring-2 ring-white/50'
          : 'border-zinc-600 hover:border-zinc-400'
      }`}
      style={
        isTransparent
          ? {
              backgroundImage:
                'linear-gradient(45deg, #4b4b57 25%, transparent 25%), linear-gradient(-45deg, #4b4b57 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b4b57 75%), linear-gradient(-45deg, transparent 75%, #4b4b57 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
              backgroundColor: '#2a2a34',
            }
          : { backgroundColor: option.swatch }
      }
      title={option.label}
      aria-label={option.label}
    />
  )
}

function ColorPalettePopup({
  activePreset,
  activeTintColor,
  onSelect,
  onClose,
}: {
  activePreset: string
  activeTintColor: string
  onSelect: (option: OverlayColorOption) => void
  onClose: () => void
}) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={popupRef}
      className="absolute left-0 top-full z-50 mt-1.5 w-[13.5rem] rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl"
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Choose overlay color
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {OVERLAY_COLOR_PALETTE.map((option) => (
          <PaletteSwatch
            key={option.id}
            option={option}
            selected={isPaletteColorSelected(option, activePreset as OverlayTintPreset, activeTintColor)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

export function OverlayTintPicker({ compact = false }: OverlayTintPickerProps) {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const [popupOpen, setPopupOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activePreset = settings.overlayTintPreset ?? 'red'
  const activeTintColor = settings.overlayTintColor
  const activeOpacity = settings.overlayTintOpacity ?? DEFAULT_OVERLAY_TINT_OPACITY
  const isTransparent = isTransparentOverlayTint(activePreset)
  const colorLabel = getOverlayColorLabel(activePreset, activeTintColor)
  const swatchStyle = getOverlaySwatchStyle(activePreset, activeTintColor)

  const selectColor = (option: OverlayColorOption) => {
    updateSettings(applyOverlayColorOption(option))
    setPopupOpen(false)
  }

  const opacityPercent = Math.round(activeOpacity * 100)

  return (
    <div ref={containerRef} className="relative space-y-2">
      {!compact && (
        <p className="mb-2 text-sm text-zinc-400">
          Pick an overlay tint from the color palette. Before/after files still
          auto-apply red or green on upload.
        </p>
      )}
      <button
        type="button"
        onClick={() => setPopupOpen((open) => !open)}
        className={`flex w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 text-left hover:border-zinc-500 ${
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        }`}
      >
        <span
          className={`shrink-0 rounded border border-zinc-600 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`}
          style={swatchStyle}
        />
        <span className={`flex-1 truncate text-zinc-300 ${compact ? 'text-[10px]' : 'text-sm'}`}>
          {colorLabel}
        </span>
        <span className="text-zinc-500">▾</span>
      </button>
      {!isTransparent && (
        <label className={`block text-zinc-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Opacity {opacityPercent}%
          <input
            type="range"
            min={MIN_OVERLAY_TINT_OPACITY}
            max={MAX_OVERLAY_TINT_OPACITY}
            step={0.05}
            value={activeOpacity}
            onChange={(event) =>
              updateSettings({ overlayTintOpacity: Number(event.target.value) })
            }
            className="mt-1 w-full accent-rose-400"
          />
        </label>
      )}
      {popupOpen && (
        <ColorPalettePopup
          activePreset={activePreset}
          activeTintColor={activeTintColor}
          onSelect={selectColor}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </div>
  )
}
