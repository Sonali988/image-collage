/** Single editor preview <video> so we can pause it when leaving the tab or exporting. */
let editorPreviewVideo: HTMLVideoElement | null = null

export function registerEditorPreviewVideo(element: HTMLVideoElement | null) {
  if (editorPreviewVideo && editorPreviewVideo !== element) {
    editorPreviewVideo.pause()
  }
  editorPreviewVideo = element
}

export function pauseEditorPreviewVideo() {
  editorPreviewVideo?.pause()
}
