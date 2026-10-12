import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings } from '../types'
import { loadImage } from '../utils/imageLoader'
import { getVideoContentBox } from '../utils/videoPageLayout'

type VideoPagePreviewProps = {
  settings: AppSettings
  videoSrc: string
  muted: boolean
  className?: string
  emptyLabel?: string
}

export function VideoPagePreview({
  settings,
  videoSrc,
  muted,
  className = '',
  emptyLabel = 'Upload a video to preview',
}: VideoPagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [videoSize, setVideoSize] = useState({ w: 16, h: 9 })
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!settings.backgroundImageDataUrl) {
      setBgUrl(null)
      return
    }
    let cancelled = false
    void loadImage(settings.backgroundImageDataUrl).then(() => {
      if (!cancelled) setBgUrl(settings.backgroundImageDataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [settings.backgroundImageDataUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = useMemo(() => {
    if (containerSize.w <= 0 || containerSize.h <= 0) return 1
    return Math.min(
      containerSize.w / settings.backgroundWidth,
      containerSize.h / settings.backgroundHeight,
    )
  }, [containerSize, settings.backgroundWidth, settings.backgroundHeight])

  const contentBox = useMemo(
    () => getVideoContentBox(videoSize.w, videoSize.h, settings),
    [videoSize, settings],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
  }, [muted, videoSrc])

  if (!videoSrc) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 text-sm text-zinc-500 ${className}`}
      >
        {emptyLabel}
      </div>
    )
  }

  const frameStyle = {
    width: settings.backgroundWidth * scale,
    height: settings.backgroundHeight * scale,
  }

  const backgroundStyle =
    !settings.useSolidBackground && bgUrl
      ? {
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
        }
      : { backgroundColor: settings.backgroundColor }

  const videoStyle = {
    left: contentBox.left * scale,
    top: contentBox.top * scale,
    width: contentBox.width * scale,
    height: contentBox.height * scale,
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-black ${className}`}
    >
      <div className="relative shrink-0 overflow-hidden rounded-sm" style={frameStyle}>
        <div className="absolute inset-0" style={backgroundStyle} />
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className="absolute object-contain"
          style={videoStyle}
          controls
          playsInline
          muted={muted}
          onLoadedMetadata={(event) => {
            const el = event.currentTarget
            setVideoSize({
              w: el.videoWidth || 16,
              h: el.videoHeight || 9,
            })
          }}
        />
      </div>
    </div>
  )
}
