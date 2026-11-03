import { useEffect, useState } from 'react'

const cache = {}

// 'light' or 'dark': how bright the bottom of an image is, where the title
// overlay sits. Light images get dark text so titles stay readable.
export default function useImageTone(src) {
  const [tone, setTone] = useState(cache[src] ?? 'dark')

  useEffect(() => {
    if (!src || cache[src]) return undefined
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        // Bottom 40% of the image: average relative luminance, 0 (black) to 1 (white).
        const top = Math.floor(size * 0.6)
        const { data } = ctx.getImageData(0, top, size, size - top)
        let sum = 0
        for (let i = 0; i < data.length; i += 4) {
          sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
        }
        cache[src] = sum / (data.length / 4) > 0.6 ? 'light' : 'dark'
      } catch {
        cache[src] = 'dark' // e.g. a cross-origin image the canvas can't read
      }
      if (!cancelled) setTone(cache[src])
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return tone
}
