import { LayerArgs, ScaleNumeric, XY, Point, ZoomExtents, Scales } from "./types";

const round = (num: number) => Math.floor(num * 10) / 10;

const getNewSvgPoint = (p: Point, moveOrLine: "M" | "L") => {
  return moveOrLine + round(p.x) + "," + round(p.y);
}

export const customLineGen = (lineSC: Point[], layerArgs: LayerArgs) => {
  const { width, height, margin } = layerArgs.clipPathBounds;
  const clipPathExtents = {
    x: [margin.left, width - margin.right],
    y: [height - margin.bottom, margin.top]
  };
  const lineSegmentPaths: string[] = [];
  let currLineSegment = "";
  const { x, y } = lineSC[0];
  let wasLastPointInRange = clipPathExtents.x[0] <= x && x <= clipPathExtents.x[1]
                         && clipPathExtents.y[1] <= y && y <= clipPathExtents.y[0];

  for (let i = 0; i < lineSC.length; i++) {
    const { x, y } = lineSC[i];
    const isPointInRange = clipPathExtents.x[0] <= x && x <= clipPathExtents.x[1]
                        && clipPathExtents.y[1] <= y && y <= clipPathExtents.y[0];

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

// Given a bands config for a line or point, return the numerical scales to use for x and y.
export const numScales = (bands: Partial<XY<string>> | undefined, layerArgs: LayerArgs): XY<ScaleNumeric> => {
  const { x: numericalScaleX, y: numericalScaleY } = layerArgs.scaleConfig.numericalScales;
  const { x: categoricalScaleX, y: categoricalScaleY } = layerArgs.scaleConfig.categoricalScales;
  const { x: bandX, y: bandY } = bands || {};

  return {
    x: bandX && categoricalScaleX ? categoricalScaleX.bands[bandX] : numericalScaleX,
    y: bandY && categoricalScaleY ? categoricalScaleY.bands[bandY] : numericalScaleY,
  }
}

export const getXYMinMax = (points: Point[]) => {
  const scales: Scales = {
    x: { start: Infinity, end: -Infinity },
    y: { start: Infinity, end: -Infinity }
  };
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < scales.x.start) scales.x.start = x;
    if (x > scales.x.end) scales.x.end = x;
    if (y < scales.y.start) scales.y.start = y;
    if (y > scales.y.end) scales.y.end = y;
  }
  return scales;
};

export const getSvgRectPath = (xStart: number, xEnd: number, yStart: number, yEnd: number) =>
  `M${xStart},${yStart}` + `L${xStart},${yEnd}` + `L${xEnd},${yEnd}` + `L${xEnd},${yStart}Z`
