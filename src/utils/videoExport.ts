import type { AppSettings, Page } from '../types'
import { mergeBackgroundSettings } from './canvasRenderer'
import { pauseEditorPreviewVideo } from './editorVideoPlayback'
import { loadImage } from './imageLoader'
import { drawVideoPageFrame } from './videoPoster'
import { getVideoBlob } from './videoBlobStorage'

const RECORD_FPS = 30

let compositedExportInFlight = false

function pickRecorderMimeType(): string | null {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const mimeType of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return null
}

function buildRecordingStream(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  includeAudio: boolean,
): MediaStream {
  const canvasStream = canvas.captureStream(RECORD_FPS)
  if (!includeAudio) return canvasStream

  try {
    const videoStream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream()
    const audioTracks = videoStream.getAudioTracks()
    if (audioTracks.length === 0) return canvasStream
    return new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
  } catch {
    return canvasStream
  }
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve()
      return
    }
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video for export'))
  })
}

function startCompositedRecording(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  settings: AppSettings,
  bgImage: HTMLImageElement | null,
  mimeType: string,
  includeAudio: boolean,
  objectUrl: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let stream: MediaStream | null = null
    let recorder: MediaRecorder | null = null
    let painting = true

    const cleanup = () => {
      painting = false
      URL.revokeObjectURL(objectUrl)
      video.pause()
      video.removeAttribute('src')
      video.load()
      if (stream) {
        for (const track of stream.getTracks()) track.stop()
      }
      compositedExportInFlight = false
    }

    const paint = () => {
      if (!painting) return
      drawVideoPageFrame(ctx, settings, bgImage, video)
      requestAnimationFrame(paint)
    }

    const finish = () => {
      painting = false
      window.setTimeout(() => {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      }, 150)
    }

    video.addEventListener('ended', finish)

    const beginRecording = (withAudio: boolean) => {
      stream = buildRecordingStream(canvas, video, withAudio)
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      })
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onerror = () => {
        cleanup()
        reject(new Error('Video export recording failed'))
      }

      recorder.onstop = () => {
        const type = mimeType.split(';')[0] ?? 'video/webm'
        cleanup()
        resolve(new Blob(chunks, { type }))
      }

      recorder.start(200)
      paint()
    }

    void video
      .play()
      .then(() => beginRecording(includeAudio))
      .catch(() => {
        video.muted = true
        void video
          .play()
          .then(() => beginRecording(false))
          .catch(() => {
            cleanup()
            reject(new Error('Could not play video for export'))
          })
      })
  })
}

/** Record the page background + centered video to a WebM blob (export / zip). */
export async function exportCompositedVideoBlob(
  page: Page,
  globalSettings: AppSettings,
): Promise<Blob | null> {
  if (!page.sourceVideoId) return null
  if (typeof MediaRecorder === 'undefined') return null
  if (compositedExportInFlight) return null

  const mimeType = pickRecorderMimeType()
  if (!mimeType) return null

  compositedExportInFlight = true
  pauseEditorPreviewVideo()

  const fileBlob = await getVideoBlob(page.sourceVideoId)
  if (!fileBlob) {
    compositedExportInFlight = false
    return null
  }

  const settings = mergeBackgroundSettings(page.settings, globalSettings)
  const bgImage = settings.backgroundImageDataUrl
    ? await loadImage(settings.backgroundImageDataUrl)
    : null

  const objectUrl = URL.createObjectURL(fileBlob)
  const video = document.createElement('video')
  video.playsInline = true
  video.preload = 'auto'
  video.src = objectUrl

  try {
    await waitForVideoMetadata(video)
  } catch {
    URL.revokeObjectURL(objectUrl)
    compositedExportInFlight = false
    return null
  }

  const includeAudio = !(page.videoMuted ?? false)
  video.muted = !includeAudio
  if (includeAudio) {
    video.volume = 0
  }

  const canvas = document.createElement('canvas')
  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(objectUrl)
    compositedExportInFlight = false
    return null
  }

  try {
    return await startCompositedRecording(
      video,
      canvas,
      ctx,
      settings,
      bgImage,
      mimeType,
      includeAudio,
      objectUrl,
    )
  } catch {
    compositedExportInFlight = false
    return null
  }
}

export function compositedVideoExportFilename(pageName: string): string {
  const base = pageName.replace(/\.[^.]+$/, '') || pageName || 'video'
  return `${base}.webm`
}
