import { DeepWriteable } from "@/types";
import { Bounds } from "./types"

export const deepCopy = <T>(x: T): DeepWriteable<T> => {
  return JSON.parse(JSON.stringify(x));
}

export const getInner = ({ width, height, margin }: Bounds) => {
  return {
    x: {
      start: margin.x.start,
      end: width - margin.x.end,
      size: width - margin.x.start - margin.x.end,
      center: (width - margin.x.start - margin.x.end) / 2 + margin.x.start,
    },
    y: {
      start: margin.y.start,
      end: height - margin.y.end,
      size: height - margin.y.start - margin.y.end,
      center: (height - margin.y.start - margin.y.end) / 2 + margin.y.start,
    },
  }
}
