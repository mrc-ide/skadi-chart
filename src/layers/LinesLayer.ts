// An abstract class for layers that draw lines, i.e. AreaLayer and TracesLayer

import { AreaLineConfig, AreaLines, D3Selection, LayerArgs, LineConfig, Lines, Point, RDPOptions, ScaleNumeric, XY, ZoomExtents } from "@/types";
import { OptionalLayer } from "./Layer";
import { numScales } from "@/helpers";

// see https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Line_defined_by_two_points
// we compute the expression without denominator because it is faster and still proportional
// NOTE: this is independent of coordinate system
const fastPerpendicularDistance = (
  rangeY: number, rangeX: number, crossProduct: number, point: Point
) => {
  return rangeY * point.x - rangeX * point.y + crossProduct;
};

// we round each point because we only care about precision up to one pixel, any more is
// irrelevant for svg rasterisation
const roundPoint = (point: Point) => {
  const xRounded = Math.round(point.x);
  const yRounded = Math.round(point.y);
  return { x: xRounded, y: yRounded };
};

/*
  see https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm#Algorithm
  In a nutshell:
  1. Draw straight line between start point, a, and end point, b, (these change but initially it is the
     start and end of the line)
  2. We pick a parameter called epsilon
  3. Find the furthest point, x, outside a region epsilon away from straight line. If there is no
     point outside a region of epsilon around the straight line then delete all points except
     start and end and return
  4. Start from step 1 with two more times with [start point, end point] as [a, x] and [x, b]

  Essentially it deletes points which are approximately in a straight line (approximately being defined
  by epsilon here) and keeps the more interesting spiky points.

  This is a safe way to lower resolution of a line without losing the important detail
*/
const doRDP = (
  pointsSC: Point[], slice: [number, number], epsilon: number
): Point[] => {
  const startSC = pointsSC[slice[0]];
  const endSC = pointsSC[slice[1]];

  // pre-compute coeficients that'll be used in the for loop for perpendicular
  // distance calculations
  const rangeYSC = endSC.y - startSC.y;
  const rangeXSC = endSC.x - startSC.x;
  const crossProductSC = endSC.x * startSC.y - endSC.y * startSC.x;

  // we are applying this algorthim in svg coordinates as we want to lower resolution of lines based on
  // visual distance instead of data coordinates (DC)
  //
  // start by finding the point with the maximum svg coordinate distance (proportional to pixel distance)
  let dMaxFastSC = 0;
  let index = 0;
  const abs = Math.abs;
  for (let i = slice[0] + 1; i < slice[1] - 1; i++) {
    const dSC = abs(fastPerpendicularDistance(rangeYSC, rangeXSC, crossProductSC, pointsSC[i]));
    if (dSC > dMaxFastSC) {
      dMaxFastSC = dSC;
      index = i;
    }
  }

  // compute denominator once from https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Line_defined_by_two_points
  const dMaxSC = dMaxFastSC / Math.sqrt(rangeYSC * rangeYSC + rangeXSC * rangeXSC);

  // if there is point outside epsilon band repeat, else delete points in a straight line
  if (dMaxSC > epsilon) {
    const slice1 = [slice[0], index] as [number, number];
    const res1 = doRDP(pointsSC, slice1, epsilon);

    const slice2 = [index, slice[1]] as [number, number];
    const res2 = doRDP(pointsSC, slice2, epsilon);

    return [...res1, ...res2];
  } else {
    const startRoundedSC = roundPoint(pointsSC[slice[0]]);
    const endRoundedSC = roundPoint(pointsSC[slice[1]]);
    return [startRoundedSC, endRoundedSC];
  }
};

const RDPAlgorithm = (linesSC: Point[][], epsilon: number) => {
  return linesSC.map(l => {
    const slice = [0, l.length - 1] as [number, number];
    return doRDP(l, slice, epsilon);
  });
};

const round = (num: number) => Math.floor(num * 10) / 10;

const pointIsInXRange = (p: Point, zoomExtents: ZoomExtents) => {
  return zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1];
}

export abstract class LinesLayer<Metadata> extends OptionalLayer {
  protected paths: D3Selection<SVGPathElement>[] = [];
  protected getNewPoint: null | ((x: number, y: number, t: number) => Point) = null;
  protected lowResLinesSC: Point[][] = [];
  protected preZoomYOriginSC: number | null = null;

  constructor(
    public linesDC: AreaLines<Metadata> | Lines<Metadata>,
    public options: RDPOptions & Record<string, any>
  ) {
    super();
  };

  draw = (layerArgs: LayerArgs, currentExtentsDC: ZoomExtents) => {
    this.updateLowResLinesSC(layerArgs);

    this.paths = this.linesDC.map((line, index) => {
      const scales = numScales(line.bands, layerArgs);

      const currentExtentsSC: ZoomExtents = {
        x: [scales.x(currentExtentsDC.x[0]), scales.x(currentExtentsDC.x[1])],
        y: [scales.y(currentExtentsDC.y[0]), scales.y(currentExtentsDC.y[1])],
      };

      const linePathSC = this.customLineGen(this.lowResLinesSC[index], currentExtentsSC);
      
      const yOriginSC = layerArgs.scaleConfig.linearScales.y(0);
      
      const currLineSC = this.lowResLinesSC[index];

      const ACTUALlinepathsc = this.getNewSvgPoint({ ...currLineSC[0], y: yOriginSC }, "M")
        + "L" + linePathSC.substring(1)
        + this.getNewSvgPoint({ ...currLineSC[currLineSC.length - 1], y: yOriginSC }, "L")
        + "Z";            
      
      return this.drawLinePath(line, ACTUALlinepathsc, index, layerArgs);
    });

    this.beforeZoom = this.beforeZoomFunc(layerArgs.scaleConfig.linearScales);
    this.zoom = this.zoomFunc(layerArgs);
  }

  protected abstract drawLinePath(lineDC: LineConfig<Metadata> | AreaLineConfig<Metadata>, linePathSC: string, index: number, layerArgs: LayerArgs): D3Selection<SVGPathElement>;

  protected getNewSvgPoint = (p: Point, moveOrLine: "M" | "L") => `${moveOrLine}${round(p.x)},${round(p.y)}`;

  protected updateLowResLinesSC = (layerArgs: LayerArgs) => {
    const linesSC = this.linesDC.map(l => {
      const scales = numScales(l.bands, layerArgs);
      return l.points.map(p => ({ x: scales.x(p.x), y: scales.y(p.y) }));
    });
    const rdpEpsilon = this.options.RDPEpsilon;
    if (rdpEpsilon || rdpEpsilon === 0) {
      this.lowResLinesSC = RDPAlgorithm(linesSC, rdpEpsilon);
    } else {
      this.lowResLinesSC = linesSC;
    }
  };

  // This function is here as if it's the one from traceslayer, but with the correct pointRangeCheck for AreaLayer.
  protected customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents, pointRangeCheck?: any) => {
    let retStr = "";
    let wasPrevPointInRange = pointIsInXRange(lineSC[0], zoomExtents);

    for (let i = 0; i < lineSC.length; i++) {
      const isPointInRange = pointIsInXRange(lineSC[i], zoomExtents);

      // if last point in range we always want to add next point even if it
      // isn't in range because we want the line to at least continue off the
      // right edge of the svg
      //
      // if the last point wasn't in range but this point is, then we must be
      // at the start of a new line segment so add the previous point too
      // because we want the line to go off the left edge of the svg
      if (wasPrevPointInRange) {
        retStr += this.getNewSvgPoint(lineSC[i], retStr ? "L" : "M");
      } else if (isPointInRange) {
        // prev point will always exist, i.e. i will never be 0 in this branch
        // because wasLastPointInRange will always match isPointInRange for
        // i = 0 so we have to fall into the previous branch
        retStr += this.getNewSvgPoint(lineSC[i - 1], "M");
        retStr += this.getNewSvgPoint(lineSC[i], "L");
      }

      wasPrevPointInRange = isPointInRange;
    }

    return retStr;
  };

  // Define a custom tween for the area layer, which wraps the traces layer custom tween.

  // We do a custom animation because it is faster than d3's default.
  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease, t = 0 is the start state of
  // your animation, t = 1 is the end state of your animation
  protected customTween = (
    index: number,
    zoomExtents: ZoomExtents,
    // layerArgs: LayerArgs,
    // ...lineGenArgs: any[]
  ) => {
    const currLineSC = this.lowResLinesSC[index];
    
    return (t: number) => {
      const intermediateLineSC = currLineSC.map(({ x, y }) => this.getNewPoint!(x, y, t));
      // Use the traces customLineGen (except we use pointIsInXRange)
      return this.customLineGen(intermediateLineSC, zoomExtents)
      // return this.customLineGen(intermediateLineSC, zoomExtents, ...lineGenArgs) // could be a callback
    };
  }

  protected areaCustomTween = (
    index: number,
    zoomExtents: ZoomExtents,
  ) => {
    const currLineSC = this.lowResLinesSC[index];

    return (t: number) => {
      const tracesCustomTweenSvgString = this.customTween(index, zoomExtents)(t);

      const yOriginSC = this.preZoomYOriginSC!;
      
      return this.getNewSvgPoint(this.getNewPoint!(currLineSC[0].x, yOriginSC, t), "M")
        + "L" + tracesCustomTweenSvgString.substring(1)
        + this.getNewSvgPoint(this.getNewPoint!(currLineSC[currLineSC.length - 1].x, yOriginSC, t), "L")
        + "Z";
    }
  }

  // Returns a function to be assigned to beforeZoom
  protected beforeZoomFunc = (scales: XY<ScaleNumeric>) => {
    return (zoomExtentsDC: ZoomExtents) => {
      const { x: scaleX, y: scaleY } = scales;
      
      this.preZoomYOriginSC = scaleY(0); // This logic to go into arealayer.

      // we have to convert the extents to SC from DC to find out what pixel
      // scaling we need
      const newExtentXDC = zoomExtentsDC.x!;
      const newExtentYDC = zoomExtentsDC.y!;
      const newExtentXSC = [scaleX(newExtentXDC[0]), scaleX(newExtentXDC[1])];
      const newExtentYSC = [scaleY(newExtentYDC[0]), scaleY(newExtentYDC[1])];

      const oldExtentXDC = scaleX.domain();
      const oldExtentYDC = scaleY.domain();
      const oldExtentXSC = [scaleX(oldExtentXDC[0]), scaleX(oldExtentXDC[1])];
      const oldExtentYSC = [scaleY(oldExtentYDC[0]), scaleY(oldExtentYDC[1])];

      const scalingX = (oldExtentXSC[1] - oldExtentXSC[0]) / (newExtentXSC[1] - newExtentXSC[0]);
      const scalingY = (oldExtentYSC[1] - oldExtentYSC[0]) / (newExtentYSC[1] - newExtentYSC[0]);

      // translation to make sure the start of the zoomed in graph is the start of the user
      // brush selection
      const offsetXSC = scalingX * scaleX(newExtentXDC[0]) - scaleX(oldExtentXDC[0]);
      const offsetYSC = scalingY * scaleY(newExtentYDC[0]) - scaleY(oldExtentYDC[0]);

      // useful to precompute
      // here, scale means factor
      const scaleRelativeX = scalingX - 1;
      const scaleRelativeY = scalingY - 1;

      // this function gives us the x coordinate at any point t (between 0 and 1) of the
      // animation, t = 0 gives the x points of the original traces, t = 1 gives the zoomed
      // in line x coordinates
      // here, x and y are in SC, representing the starting coords. yOriginSC would go in nicely.
      this.getNewPoint = (x, y, t) => ({
        x: x * (t * scaleRelativeX + 1) - t * offsetXSC,
        y: y * (t * scaleRelativeY + 1) - t * offsetYSC
      });
    };
  }

  // the zoom layer updates scaleX and scaleY which change our customLineGen function
  protected zoomFunc = (layerArgs: LayerArgs) => {
    return async (zoomExtentsDC: ZoomExtents) => {
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      const zoomExtentsSC: ZoomExtents = {
        x: [scaleX(zoomExtentsDC.x[0]), scaleX(zoomExtentsDC.x[1])],
        y: [scaleY(zoomExtentsDC.y[0]), scaleY(zoomExtentsDC.y[1])],
      };

      await Promise.all(this.linesDC.map((_, i) => this.pathAnimation(i, zoomExtentsSC, layerArgs)));

      // after zoom animation, calculate appropriate resolution lines again and replace
      // without the user knowing
      this.updateLowResLinesSC(layerArgs);
      this.replacePathsAfterZoom(zoomExtentsSC, layerArgs);
    };
  }

  protected abstract pathAnimation(index: number, zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs): Promise<void>;

  protected abstract replacePathsAfterZoom(zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs): void;
}
