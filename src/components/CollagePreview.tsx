import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { renderCollageFromPages } from '../utils/canvasRenderer'
import { MIN_COLLAGE_PANELS } from '../config/collage'
import type { CollageRenderOptions } from '../types'

type CollagePreviewProps = {
  className?: string
}

export function CollagePreview({ className = '' }: CollagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pages = useAppStore((state) => state.pages)
  const collageSelectedIds = useAppStore((state) => state.collageSelectedIds)
  const collageTitles = useAppStore((state) => state.collageTitles)
  const collageShowTitles = useAppStore((state) => state.collageShowTitles)
  const collageImageScales = useAppStore((state) => state.collageImageScales)
  const settings = useAppStore((state) => state.settings)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

  const selectedCount = collageSelectedIds.length
  const canPreview = selectedCount >= MIN_COLLAGE_PANELS
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
    if (!canPreview) {
      setPreviewUrl(null)
      return
    }

    let cancelled = false
    setIsRendering(true)

    const renderPreview = async () => {
      try {
        const selectedPages = collageSelectedIds
          .map((id) => pages.find((page) => page.id === id && !page.isCollage))
          .filter((page): page is NonNullable<typeof page> => Boolean(page))

        if (selectedPages.length < MIN_COLLAGE_PANELS) {
          if (!cancelled) setPreviewUrl(null)
          return
        }

        const collageOptions: CollageRenderOptions = {
          titles: collageTitles.slice(0, selectedPages.length),
          showTitles: collageShowTitles,
          showCenterDivider: selectedPages.length === 2,
          imageScales: collageImageScales.slice(0, selectedPages.length),
        }

        const collageDataUrl = await renderCollageFromPages(
          selectedPages,
          settings,
          collageOptions,
        )

        if (!cancelled) setPreviewUrl(collageDataUrl || null)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
    }
  }, [
    canPreview,
    collageSelectedIds,
    collageTitles,
    collageShowTitles,
    collageImageScales,
    pages,
    settings,
  ])

  const placeholder = (
    <p className="px-6 text-center text-sm text-zinc-500">
      {!canPreview
        ? `Select ${MIN_COLLAGE_PANELS}–3 pages to preview your collage.`
        : isRendering
          ? 'Rendering preview…'
          : 'Preview unavailable'}
    </p>
  )

  return (
    <div
      ref={containerRef}
      className={`flex h-full min-h-0 items-center justify-center rounded-xl border border-zinc-800 bg-black/80 ${className}`}
    >
      {canPreview && previewUrl && displaySize.width > 0 ? (
        <img
          src={previewUrl}
          alt="Collage preview"
          width={displaySize.width}
          height={displaySize.height}
          className="rounded-md shadow-lg shadow-black/40"
          style={{ width: displaySize.width, height: displaySize.height }}
        />
      ) : (
        placeholder
      )}
    </div>
  )
}
