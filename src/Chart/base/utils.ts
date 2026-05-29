import { Bounds } from "./types"

export const getInner = (bounds: Bounds) => {
  return {
    x: { start: bounds.margin.x.start, end: bounds.width - bounds.margin.x.end },
    y: { start: bounds.margin.y.start, end: bounds.height - bounds.margin.y.end },
  }
}
