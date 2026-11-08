import { MathUtils } from 'three'

// One coordinate system for the shoe AND the box. The normalized GLB is
// 2.65 wide, 1.36 tall, 1.03 deep; the cavity includes a margin on every side.
export const BOX = { width: 3.12, depth: 2.04, height: 1.7, wall: 0.065, floor: -0.88, rim: 0.82 }
export const phase = (progress: number, start: number, end: number) => MathUtils.smoothstep(progress, start, end)

export function presentation(width: number, height: number) {
  const aspect = width / Math.max(height, 1)
  const mobile = width < 1024 || aspect < 1
  const short = height < 500
  // Fit the full lid sweep and podium, reserving the right rail and text below.
  // Use the closest camera distance, so inspection never enlarges beyond this fit.
  const worldHeight = 2 * (mobile ? 6.2 : 6.7) * Math.tan(((mobile ? 50 : 38) * Math.PI) / 360)
  const rail = mobile ? 80 : 112
  const availableWidth = Math.max(160, width - rail - (short ? width * 0.34 : 32))
  const widthFit = ((availableWidth / height) * worldHeight) / 4.1
  const heightFit = ((short ? 0.56 : 0.57) * worldHeight) / 4
  const scale = Math.min(mobile ? 0.72 : 0.94, widthFit, heightFit)
  return {
    mobile,
    scale,
    x: short ? worldHeight * aspect * 0.16 : mobile ? (-worldHeight * rail) / height / 2 : 0.4,
    y: short ? 0.15 : mobile ? 0.36 : 0.15,
  }
}
