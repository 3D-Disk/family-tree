import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clampCrop, frameScale, MAX_ZOOM, MIN_ZOOM, rotateCrop, type PhotoCrop } from '../model/photoCrop.ts'
import { usePhotoUrl } from '../state/usePhotoUrl.ts'

interface Props {
  photo: Blob
  initialCrop: PhotoCrop
  onDone(crop: PhotoCrop): void
  onCancel(): void
}

/** Pop-up for positioning, zooming and rotating a profile photo inside the round frame. */
export default function PhotoAdjuster({ photo, initialCrop, onDone, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const url = usePhotoUrl(photo)
  const [size, setSize] = useState<[number, number] | null>(null)
  const [crop, setCrop] = useState(initialCrop)
  const [frameSize, setFrameSize] = useState(280)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    const d = dialog.current!
    d.showModal()
    return () => d.close()
  }, [])

  // Measure the frame (it shrinks on small screens).
  useEffect(() => {
    const el = frame.current!
    const ro = new ResizeObserver(() => setFrameSize(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const update = (fn: (c: PhotoCrop) => PhotoCrop) => {
    if (!size) return
    setCrop((c) => clampCrop(fn(c), size[0], size[1]))
  }

  // Mouse wheel zoom (needs a non-passive listener to stop the page scrolling).
  useEffect(() => {
    const el = frame.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!size) return
      setCrop((c) => clampCrop({ ...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.0015) }, size[0], size[1]))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size])

  function onPointerDown(e: PointerEvent) {
    frame.current!.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: PointerEvent) {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    if (map.size === 1) {
      const dx = (next.x - prev.x) / frameSize
      const dy = (next.y - prev.y) / frameSize
      update((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
    } else if (map.size === 2) {
      // Pinch: zoom by the change in distance between the two fingers.
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      if (before > 0) update((c) => ({ ...c, zoom: (c.zoom * after) / before }))
    }
    map.set(e.pointerId, next)
  }

  function onPointerUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId)
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = 0.02
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    update((c) => ({ ...c, x: c.x + m[0], y: c.y + m[1] }))
  }

  const scale = size ? frameScale(size[0], size[1], crop) * frameSize : 0

  return (
    <dialog
      ref={dialog}
      className="photo-adjuster"
      aria-label="Adjust photo"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2>Adjust photo</h2>
      <p className="photo-adjuster-help">Drag to move. Use the slider, mouse wheel or pinch to zoom.</p>

      <div
        ref={frame}
        className="photo-frame"
        tabIndex={0}
        aria-label="Photo position. Use arrow keys to move."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              setSize([img.naturalWidth, img.naturalHeight])
              setCrop((c) => clampCrop(c, img.naturalWidth, img.naturalHeight))
            }}
            style={
              size
                ? {
                    width: size[0],
                    height: size[1],
                    marginLeft: -size[0] / 2,
                    marginTop: -size[1] / 2,
                    transform: `translate(${crop.x * frameSize}px, ${crop.y * frameSize}px) rotate(${crop.rotation}deg) scale(${scale})`,
                  }
                : { visibility: 'hidden' }
            }
          />
        )}
        <div className="photo-frame-mask" />
      </div>

      <div className="photo-controls">
        <label className="zoom-control">
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            aria-label="Zoom"
            onChange={(e) => update((c) => ({ ...c, zoom: Number(e.target.value) }))}
          />
          <span aria-hidden="true">+</span>
        </label>
        <button type="button" className="btn" onClick={() => size && setCrop((c) => rotateCrop(c, size[0], size[1]))}>
          Rotate ⟳
        </button>
      </div>

      <div className="confirm-dialog-buttons">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onDone(crop)} disabled={!size}>
          Done
        </button>
      </div>
    </dialog>
  )
}
