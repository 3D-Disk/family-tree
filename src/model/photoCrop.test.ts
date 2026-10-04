import { describe, expect, it } from 'vitest'
import { clampCrop, DEFAULT_CROP, frameScale, rotateCrop, rotatedSize } from './photoCrop.ts'

describe('photo framing', () => {
  it('swaps width and height when rotated sideways', () => {
    expect(rotatedSize(400, 200, 90)).toEqual([200, 400])
    expect(rotatedSize(400, 200, 180)).toEqual([400, 200])
  })

  it('scales so the short side fills the frame at zoom 1', () => {
    expect(frameScale(400, 200, DEFAULT_CROP)).toBeCloseTo(1 / 200)
    expect(frameScale(400, 200, { ...DEFAULT_CROP, zoom: 2 })).toBeCloseTo(2 / 200)
  })

  it('only lets a wide photo slide sideways at zoom 1', () => {
    // 400x200 at zoom 1 is 2 frames wide, 1 frame tall.
    expect(clampCrop({ ...DEFAULT_CROP, x: 5, y: 5 }, 400, 200)).toMatchObject({ x: 0.5, y: 0 })
    expect(clampCrop({ ...DEFAULT_CROP, x: -5 }, 400, 200)).toMatchObject({ x: -0.5 })
  })

  it('allows more movement when zoomed in', () => {
    const c = clampCrop({ ...DEFAULT_CROP, zoom: 2, x: 5, y: 5 }, 200, 200)
    expect(c.x).toBeCloseTo(0.5)
    expect(c.y).toBeCloseTo(0.5)
  })

  it('keeps zoom within limits', () => {
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 0.2 }, 100, 100).zoom).toBe(1)
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 50 }, 100, 100).zoom).toBe(5)
  })

  it('rotates a quarter turn at a time and recentres', () => {
    let c = rotateCrop({ ...DEFAULT_CROP, x: 0.3 }, 400, 200)
    expect(c).toMatchObject({ rotation: 90, x: 0, y: 0 })
    c = rotateCrop(rotateCrop(rotateCrop(c, 400, 200), 400, 200), 400, 200)
    expect(c.rotation).toBe(0)
  })
})
