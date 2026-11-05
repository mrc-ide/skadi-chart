import { Bounds } from "./types"
import { makeObjXY } from "@/helpers";

export const getInner = ({ width, height, margin }: Bounds) => {
  const len = { x: width, y: height };
  return makeObjXY(axis => ({
    start: margin[axis].start,
    end: len[axis] - margin[axis].end,
    size: len[axis] - margin[axis].start - margin[axis].end,
    center: (len[axis] - margin[axis].start - margin[axis].end) / 2
            + margin[axis].start,
  }));
};
