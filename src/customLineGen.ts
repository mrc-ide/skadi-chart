import { Point, ZoomExtents } from "./types";

const round = (num: number) => Math.floor(num * 10) / 10;

const getNewSvgPoint = (p: Point, moveOrLine: "M" | "L") => {
  return moveOrLine + round(p.x) + "," + round(p.y);
}

export const customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents) => {
  const lineSegmentPaths: string[] = [];
  let currLineSegment = "";
  const { x, y } = lineSC[0];
  let wasLastPointInRange = zoomExtents.x[0] <= x && x <= zoomExtents.x[1]
                         && zoomExtents.y[1] <= y && y <= zoomExtents.y[0];

  for (let i = 0; i < lineSC.length; i++) {
    const { x, y } = lineSC[i];
    const isPointInRange = zoomExtents.x[0] <= x && x <= zoomExtents.x[1]
                        && zoomExtents.y[1] <= y && y <= zoomExtents.y[0];

    // if last point in range we always want to add next point even if it
    // isn't in range because we want the line to at least continue off the
    // right edge of the svg
    //
    // if the last point wasn't in range but this point is, then we must be
    // at the start of a new line segment so add the previous point too
    // because we want the line to go off the left edge of the svg
    if (wasLastPointInRange) {
      currLineSegment += getNewSvgPoint(lineSC[i], currLineSegment ? "L" : "M");
    } else if (isPointInRange) {
      // prev point will always exist, i.e. i will never be 0 in this branch
      // because wasLastPointInRange will always match isPointInRange for
      // i = 0 so we have to fall into the previous branch
      if (currLineSegment) lineSegmentPaths.push(currLineSegment);
      currLineSegment = "";
      currLineSegment += getNewSvgPoint(lineSC[i - 1], "M");
      currLineSegment += getNewSvgPoint(lineSC[i], "L");
    }
    wasLastPointInRange = isPointInRange;
  }
  if (currLineSegment) lineSegmentPaths.push(currLineSegment);

  return lineSegmentPaths;
};
