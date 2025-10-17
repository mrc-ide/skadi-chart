import { Point, ZoomExtents } from "./types";

const round = (num: number) => Math.floor(num * 10) / 10;

export const getNewSvgPoint = (p: Point, moveOrLine: "M" | "L") => {
  return moveOrLine + round(p.x) + "," + round(p.y);
}

const pointIsInRange = (p: Point, zoomExtents: ZoomExtents, fillArea?: boolean) => {
  const pointIsInXRange = zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1];
  if (fillArea) {
    // For SVG paths that we intend to fill, we need to plot all points within
    // the x range, regardless of their y value, to ensure the area is filled correctly.
    return pointIsInXRange;
  }
  return pointIsInXRange && zoomExtents.y[1] <= p.y && p.y <= zoomExtents.y[0];
}

// Generates an SVG path string from a series of points in screen coordinates (SC).
// The fillArea flag indicates whether the path is intended to be filled (as in an area chart),
// but does not affect the actual path generation beyond how we determine if a point is in range:
// this will still output an open path (a line) rather than a closed path (a loop).
export const customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents, fillArea?: boolean) => {
  let retStr = "";
  let wasLastPointInRange = pointIsInRange(lineSC[0], zoomExtents, fillArea);

  for (let i = 0; i < lineSC.length; i++) {
    const isPointInRange = pointIsInRange(lineSC[i], zoomExtents, fillArea);

    // if last point in range we always want to add next point even if it
    // isn't in range because we want the line to at least continue off the
    // right edge of the svg
    //
    // if the last point wasn't in range but this point is, then we must be
    // at the start of a new line segment so add the previous point too
    // because we want the line to go off the left edge of the svg
    if (wasLastPointInRange) {
      retStr += getNewSvgPoint(lineSC[i], retStr ? "L" : "M");
    } else if (isPointInRange) {
      // prev point will always exist, i.e. i will never be 0 in this branch
      // because wasLastPointInRange will always match isPointInRange for
      // i = 0 so we have to fall into the previous branch
      retStr += getNewSvgPoint(lineSC[i - 1], "M");
      retStr += getNewSvgPoint(lineSC[i], "L");
    }
    wasLastPointInRange = isPointInRange;
  }

  return retStr;
};
