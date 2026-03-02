import { ScatterLayer } from "./layers/ScatterLayer";
import { TracesLayer } from "./layers/TracesLayer";
import { LayerArgs, ScaleNumeric, XY, Point, Scales, AxisType, D3Selection, PointWithMetadata } from "./types";

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

export const getXYMinMax = <Metadata>(
  traceLayers: TracesLayer<Metadata>[],
  scatterLayers: ScatterLayer<Metadata>[],
) => {
  const minMax: Scales = {
    x: { start: Infinity, end: -Infinity },
    y: { start: Infinity, end: -Infinity }
  };

  iterateOverPoints<Metadata>(traceLayers, scatterLayers, ({ x, y }) => {
    if (x < minMax.x.start) minMax.x.start = x;
    if (x > minMax.x.end) minMax.x.end = x;
    if (y < minMax.y.start) minMax.y.start = y;
    if (y > minMax.y.end) minMax.y.end = y;
  });

  return minMax;
};

export const getSvgRectPath = (xStart: number, xEnd: number, yStart: number, yEnd: number) =>
  `M${xStart},${yStart}` + `L${xStart},${yEnd}` + `L${xEnd},${yEnd}` + `L${xEnd},${yStart}Z`

// Convenience function for mapping a callback for all numerical scales in a per-axis scale config
export const mapScales = <T>(
  layerArgs: LayerArgs,
  callback: (scale: ScaleNumeric, axis: AxisType) => T,
): [Record<string, T>, Record<string, Record<string, T>>] => {
  const { categoricalScales, numericalScales: mainNumericalScales } = { ...layerArgs.scaleConfig };
  const mappedCategoricalScales = Object.fromEntries(Object.entries(categoricalScales).map(([axis, catScaleConfig]) => {
    const ax = axis as AxisType;
    return [
      ax,
      Object.fromEntries(Object.entries(catScaleConfig?.bands ?? {}).map(([cat, scale]) => [cat, callback(scale, ax)]),
    )];
  }));

  const mappedMainScales = Object.fromEntries(Object.entries(mainNumericalScales).map(([axis, scale]) => {
    const ax = axis as AxisType;
    return [ax, callback(scale, ax)];
  }));

  return [mappedMainScales, mappedCategoricalScales]
}

export const drawLine = (
  baseLayer: D3Selection<SVGGElement>,
  coordsSC: XY<{start: number, end: number}>,
  color: string,
) => {
  return baseLayer.append("g").append("line")
    .attr("x1", coordsSC.x.start)
    .attr("x2", coordsSC.x.end)
    .attr("y1", coordsSC.y.start)
    .attr("y2", coordsSC.y.end)
    .style("stroke", color).style("stroke-width", 0.5);
}

export const iterateOverPoints = <Metadata>(
  traceLayers: TracesLayer<Metadata>[],
  scatterLayers: ScatterLayer<Metadata>[],
  callback: (point: PointWithMetadata<Metadata>) => void
) => {
  for (let i = 0; i < traceLayers.length; i++) {
    const traceLayer = traceLayers[i];
    for (let j = 0; j < traceLayer.linesDC.length; j++) {
      const line = traceLayer.linesDC[j];
      for (let k = 0; k < line.points.length; k++) {
        const point = line.points[k];
        const pointWithMetadata: PointWithMetadata<Metadata> = {
          x: point.x,
          y: point.y,
          bands: line.bands,
          metadata: line.metadata,
        }
        callback(pointWithMetadata);
      }
    }
  }

  for (let i = 0; i < scatterLayers.length; i++) {
    const scatterLayer = scatterLayers[i];
    for (let j = 0; j < scatterLayer.points.length; j++) {
      callback(scatterLayer.points[j]);
    }
  }
};
