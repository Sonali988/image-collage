import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { renderPageToCanvas } from '../utils/canvasRenderer'
import {
  canvasToDisplayCoords,
  normalizedRectFromCanvasDrag,
  pointerToCanvasCoords,
} from '../utils/cropCoords'
import { loadImage } from '../utils/imageLoader'
import {
  getOverlayDestBoxes,
  HANDLE_CURSOR,
  hitTestOverlay,
  resizeOverlaySourceRect,
  type OverlayDestBox,
  type ResizeHandle,
} from '../utils/overlayHitTest'
import type { MarkerRect } from '../types'

type CanvasPreviewProps = {
  className?: string
  emptyLabel?: string
}

type SelectionDrag = {
  kind: 'select'
  startX: number
  startY: number
  currentX: number
  currentY: number
}

type OverlayMoveDrag = {
  kind: 'move'
  overlayId: string
  startX: number
  startY: number
  originOffsetX: number
  originOffsetY: number
}

type OverlayResizeDrag = {
  kind: 'resize'
  overlayId: string
  handle: ResizeHandle
  startX: number
  startY: number
  originRect: MarkerRect
  userScale: number
}

type InteractionDrag = SelectionDrag | OverlayMoveDrag | OverlayResizeDrag

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function CanvasPreview({
  className = '',
  emptyLabel = 'Upload a document to preview',
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settings = useAppStore((state) => state.settings)
  const sourceImageDataUrl = useAppStore((state) => state.editor.sourceImageDataUrl)
  const overlays = useAppStore((state) => state.editor.overlays)
  const documentCropRect = useAppStore((state) => state.editor.documentCropRect)
  const isCropMode = useAppStore((state) => state.editor.isCropMode)
  const isDocumentCropMode = useAppStore((state) => state.editor.isDocumentCropMode)
  const setCropMode = useAppStore((state) => state.setCropMode)
  const setDocumentCropMode = useAppStore((state) => state.setDocumentCropMode)
  const addCropOverlay = useAppStore((state) => state.addCropOverlay)
  const cropDocument = useAppStore((state) => state.cropDocument)
  const updateOverlayOffset = useAppStore((state) => state.updateOverlayOffset)
  const updateOverlayRect = useAppStore((state) => state.updateOverlayRect)
  const selectedOverlayId = useAppStore((state) => state.editor.selectedOverlayId)
  const setSelectedOverlayId = useAppStore((state) => state.setSelectedOverlayId)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [drag, setDrag] = useState<InteractionDrag | null>(null)
  const [hoverCursor, setHoverCursor] = useState('default')

  const isSelecting = isCropMode || isDocumentCropMode
  const canEditOverlays = Boolean(sourceImageDataUrl) && !isSelecting
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

    let alive = true
    void renderPageToCanvas(canvas, settings, sourceImageDataUrl, overlays, {
      skipBackground: true,
      showPlaceholderBackground: true,
      documentCropRect,
      shouldContinue: () => alive,
    })

    return () => {
      alive = false
    }
  }, [settings, sourceImageDataUrl, overlays, documentCropRect])

  useEffect(() => {
    if (!isSelecting) setDrag(null)
  }, [isSelecting])

  useEffect(() => {
    if (
      selectedOverlayId &&
      !overlays.some((overlay) => overlay.id === selectedOverlayId)
    ) {
      setSelectedOverlayId(null)
    }
  }, [overlays, selectedOverlayId, setSelectedOverlayId])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isSelecting) {
        setCropMode(false)
        setDocumentCropMode(false)
        setDrag(null)
        return
      }
      setSelectedOverlayId(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isSelecting, setCropMode, setDocumentCropMode, setSelectedOverlayId])

  const overlayBoxes = useMemo(
    () =>
      getOverlayDestBoxes(
        overlays,
        imageSize.width,
        imageSize.height,
        settings,
        documentCropRect,
      ),
    [overlays, imageSize.width, imageSize.height, settings, documentCropRect],
  )

  const finishSelectionDrag = useCallback(
    (dragState: SelectionDrag) => {
      const canvas = canvasRef.current
      if (!canvas || imageSize.width === 0) return

      const rect = normalizedRectFromCanvasDrag(
        { x: dragState.startX, y: dragState.startY },
        { x: dragState.currentX, y: dragState.currentY },
        imageSize.width,
        imageSize.height,
        settings,
        documentCropRect,
      )

      if (!rect) {
        if (isCropMode) setCropMode(false)
        if (isDocumentCropMode) setDocumentCropMode(false)
        return
      }

      if (isDocumentCropMode) {
        cropDocument(rect)
        return
      }

      addCropOverlay(rect)
    },
    [
      addCropOverlay,
      cropDocument,
      documentCropRect,
      imageSize.height,
      imageSize.width,
      isCropMode,
      isDocumentCropMode,
      setCropMode,
      setDocumentCropMode,
      settings,
    ],
  )

  const applyOverlayDrag = useCallback(
    (dragState: OverlayMoveDrag | OverlayResizeDrag, canvasX: number, canvasY: number) => {
      if (dragState.kind === 'move') {
        updateOverlayOffset(
          dragState.overlayId,
          Math.round(dragState.originOffsetX + (canvasX - dragState.startX)),
          Math.round(dragState.originOffsetY + (canvasY - dragState.startY)),
        )
        return
      }

      const nextRect = resizeOverlaySourceRect(
        dragState.originRect,
        dragState.handle,
        canvasX - dragState.startX,
        canvasY - dragState.startY,
        dragState.userScale,
        imageSize.width,
        imageSize.height,
        settings,
        documentCropRect,
      )
      updateOverlayRect(dragState.overlayId, nextRect)
    },
    [
      documentCropRect,
      imageSize.height,
      imageSize.width,
      settings,
      updateOverlayOffset,
      updateOverlayRect,
    ],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = pointerToCanvasCoords(event.clientX, event.clientY, canvas)

    if (isSelecting) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDrag({ kind: 'select', startX: x, startY: y, currentX: x, currentY: y })
      return
    }

    if (!canEditOverlays) return

    const hit = hitTestOverlay(x, y, overlayBoxes)
    if (!hit) {
      setSelectedOverlayId(null)
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedOverlayId(hit.box.overlay.id)

    if (hit.handle) {
      setDrag({
        kind: 'resize',
        overlayId: hit.box.overlay.id,
        handle: hit.handle,
        startX: x,
        startY: y,
        originRect: { ...hit.box.overlay.rect },
        userScale: hit.box.overlay.userScale,
      })
      setHoverCursor(HANDLE_CURSOR[hit.handle])
      return
    }

    setDrag({
      kind: 'move',
      overlayId: hit.box.overlay.id,
      startX: x,
      startY: y,
      originOffsetX: hit.box.overlay.offsetX ?? 0,
      originOffsetY: hit.box.overlay.offsetY ?? 0,
    })
    setHoverCursor('grabbing')
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = pointerToCanvasCoords(event.clientX, event.clientY, canvas)

    if (drag?.kind === 'select') {
      setDrag({ ...drag, currentX: x, currentY: y })
      return
    }

    if (drag?.kind === 'move' || drag?.kind === 'resize') {
      applyOverlayDrag(drag, x, y)
      return
    }

    if (!canEditOverlays) {
      setHoverCursor('default')
      return
    }

    const hit = hitTestOverlay(x, y, overlayBoxes)
    if (!hit) {
      setHoverCursor('default')
      return
    }
    setHoverCursor(hit.handle ? HANDLE_CURSOR[hit.handle] : 'grab')
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    event.currentTarget.releasePointerCapture(event.pointerId)

    if (drag.kind === 'select') {
      finishSelectionDrag(drag)
    }

    setDrag(null)
    setHoverCursor(isSelecting ? 'crosshair' : 'default')
  }

  const selectionStyle = (() => {
    if (!drag || drag.kind !== 'select' || !canvasRef.current) return null
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

  const displayBoxes = (() => {
    const canvas = canvasRef.current
    if (!canvas || displaySize.width === 0) {
      return [] as Array<{
        box: OverlayDestBox
        style: { left: number; top: number; width: number; height: number }
      }>
    }

    return overlayBoxes.map((box) => {
      const topLeft = canvasToDisplayCoords(box.destX, box.destY, canvas)
      const bottomRight = canvasToDisplayCoords(
        box.destX + box.destW,
        box.destY + box.destH,
        canvas,
      )
      return {
        box,
        style: {
          left: topLeft.x,
          top: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      }
    })
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
            <div
              className="absolute inset-0 touch-none"
              style={{
                cursor: isSelecting ? 'crosshair' : hoverCursor,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {canEditOverlays &&
                displayBoxes.map(({ box, style }) => {
                  const selected = selectedOverlayId === box.overlay.id
                  return (
                    <div
                      key={box.overlay.id}
                      className={`pointer-events-none absolute border ${
                        selected
                          ? 'border-rose-400 shadow-[0_0_0_1px_rgba(251,113,133,0.45)]'
                          : 'border-white/30'
                      }`}
                      style={style}
                    >
                      {selected &&
                        RESIZE_HANDLES.map((handle) => (
                          <span
                            key={handle}
                            className={`absolute rounded-sm border border-rose-300 bg-rose-500 ${
                              handle.length === 1 ? 'h-2 w-2.5' : 'h-2.5 w-2.5'
                            }`}
                            style={{
                              left:
                                handle === 'w' || handle === 'nw' || handle === 'sw'
                                  ? -5
                                  : handle === 'n' || handle === 's'
                                    ? '50%'
                                    : undefined,
                              right:
                                handle === 'e' || handle === 'ne' || handle === 'se'
                                  ? -5
                                  : undefined,
                              top:
                                handle === 'n' || handle === 'nw' || handle === 'ne'
                                  ? -5
                                  : handle === 'e' || handle === 'w'
                                    ? '50%'
                                    : undefined,
                              bottom:
                                handle === 's' || handle === 'sw' || handle === 'se'
                                  ? -5
                                  : undefined,
                              transform:
                                handle === 'n' || handle === 's'
                                  ? 'translateX(-50%)'
                                  : handle === 'e' || handle === 'w'
                                    ? 'translateY(-50%)'
                                    : undefined,
                            }}
                          />
                        ))}
                    </div>
                  )
                })}

              {selectionStyle && selectionStyle.width > 0 && selectionStyle.height > 0 && (
                <div
                  className={`pointer-events-none absolute border-2 border-dashed ${
                    isDocumentCropMode
                      ? 'border-amber-400 bg-amber-400/15'
                      : 'border-sky-400 bg-sky-400/15'
                  }`}
                  style={selectionStyle}
                />
              )}

              {isSelecting && (
                <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-200">
                  {isDocumentCropMode
                    ? 'Drag to crop background document · Esc to cancel'
                    : 'Drag to select crop zone · Esc to cancel'}
                </p>
              )}

              {canEditOverlays && overlays.length > 0 && !drag && (
                <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-200">
                  Drag to move · edges/corners to crop more or less · Update to save
                </p>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
