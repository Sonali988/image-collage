import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { renderPageToCanvas } from '../utils/canvasRenderer'
import {
  canvasToDisplayCoords,
  normalizedRectFromCanvasDrag,
  pointerToCanvasCoords,
} from '../utils/cropCoords'
import { loadImage } from '../utils/imageLoader'

type CanvasPreviewProps = {
  className?: string
  emptyLabel?: string
}

type DragState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function CanvasPreview({
  className = '',
  emptyLabel = 'Upload a document to preview',
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settings = useAppStore((state) => state.settings)
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)
  const overlays = useAppStore((state) => state.editor.overlays)
  const isCropMode = useAppStore((state) => state.editor.isCropMode)
  const setCropMode = useAppStore((state) => state.setCropMode)
  const addCropOverlay = useAppStore((state) => state.addCropOverlay)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [drag, setDrag] = useState<DragState | null>(null)

  const aspect = settings.backgroundHeight / settings.backgroundWidth

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width <= 0 || height <= 0) return

      let w = width
      let h = width * aspect
      if (h > height) {
        h = height
        w = height / aspect
      }
      setDisplaySize({ width: Math.floor(w), height: Math.floor(h) })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [aspect])

  useEffect(() => {
    if (!sourceImageDataUrl) {
      setImageSize({ width: 0, height: 0 })
      return
    }
    void loadImage(sourceImageDataUrl).then((image) => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
    })
  }, [sourceImageDataUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !sourceImageDataUrl) return
    void renderPageToCanvas(canvas, settings, sourceImageDataUrl, overlays)
  }, [settings, sourceImageDataUrl, overlays])

  useEffect(() => {
    if (!isCropMode) setDrag(null)
  }, [isCropMode])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCropMode) {
        setCropMode(false)
        setDrag(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isCropMode, setCropMode])

  const finishDrag = useCallback(
    (dragState: DragState) => {
      const canvas = canvasRef.current
      if (!canvas || imageSize.width === 0) return

      const rect = normalizedRectFromCanvasDrag(
        { x: dragState.startX, y: dragState.startY },
        { x: dragState.currentX, y: dragState.currentY },
        imageSize.width,
        imageSize.height,
        settings,
      )
      if (rect) addCropOverlay(rect)
      else setCropMode(false)
    },
    [addCropOverlay, imageSize.height, imageSize.width, setCropMode, settings],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isCropMode) return
    const canvas = canvasRef.current
    if (!canvas) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const { x, y } = pointerToCanvasCoords(event.clientX, event.clientY, canvas)
    setDrag({ startX: x, startY: y, currentX: x, currentY: y })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !isCropMode) return
    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = pointerToCanvasCoords(event.clientX, event.clientY, canvas)
    setDrag((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !isCropMode) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    finishDrag(drag)
    setDrag(null)
  }

  const selectionStyle = (() => {
    if (!drag || !canvasRef.current) return null
    const canvas = canvasRef.current
    const topLeft = canvasToDisplayCoords(
      Math.min(drag.startX, drag.currentX),
      Math.min(drag.startY, drag.currentY),
      canvas,
    )
    const bottomRight = canvasToDisplayCoords(
      Math.max(drag.startX, drag.currentX),
      Math.max(drag.startY, drag.currentY),
      canvas,
    )
    return {
      left: topLeft.x,
      top: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  })()

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 items-center justify-center rounded-lg border border-zinc-800 bg-black/80 ${className}`}
    >
      {!sourceImageDataUrl ? (
        <p className="px-4 text-center text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        displaySize.width > 0 && (
          <div
            className="relative"
            style={{ width: displaySize.width, height: displaySize.height }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: displaySize.width,
                height: displaySize.height,
                display: 'block',
              }}
            />
            {isCropMode && (
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {selectionStyle && selectionStyle.width > 0 && selectionStyle.height > 0 && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-sky-400 bg-sky-400/15"
                    style={selectionStyle}
                  />
                )}
                <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-200">
                  Drag to select area · Esc to cancel
                </p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
