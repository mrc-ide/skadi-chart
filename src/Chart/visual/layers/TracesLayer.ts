import { Layer } from "./Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { D3Selection, Point, ScaleNumeric, XY } from "@/types";
import { customLineGen, customLineGenerator } from "@/helpers";

export type TracesOptions = {
  RDPEpsilon: number | null
}

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
  for (let i = slice[0]; i < slice[1]; i++) {
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

    // we remove last element from res1 because we include index twice in
    // slice1 and slice2 so we have to remove the duplicate point
    return [...res1.slice(0, -1), ...res2];
  } else {
    const startRoundedSC = roundPoint(pointsSC[slice[0]]);
    const endRoundedSC = roundPoint(pointsSC[slice[1]]);
    return [startRoundedSC, endRoundedSC];
  }
};

export const RDPAlgorithm = (linesSC: Point[][], epsilon: number) => {
  return linesSC.map(l => {
    const slice = [0, l.length - 1] as [number, number];
    return doRDP(l, slice, epsilon);
  });
};

export class TracesLayer<M> extends Layer<M, null> {
  private zoomCallbacks: (() => Promise<void>)[] = [];
  private traces: D3Selection<SVGPathElement>[] = [];
  private lowResLinesSC: Point[][] = [];
  
  constructor(
    private prevOutput: PrevOutput<M>,
    private coreLayers: CoreLayers,
    private options: TracesOptions,
  ) {
    super();
  };

  zoom = async () => {
    // Implementation for zooming traces goes here
  }
  
  draw = () => {
    this.updateLowResLinesSC();
    const { getHtmlId } = this.prevOutput.baseState;

    this.traces = this.prevOutput.dataState.lines.map((lDC, index) => {
      const linePathSC = customLineGenerator(this.lowResLinesSC[index], this.prevOutput.baseState.clipPathBounds).join("");
      return this.coreLayers[CoreLayer.BaseLayer].append("path")
        .attr("id", `${getHtmlId(VisualLayer.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", "none")
        .attr("stroke", lDC.style.strokeColor || "black")
        .attr("opacity", lDC.style.opacity || 1)
        .attr("stroke-width", lDC.style.strokeWidth || 0.5)
        .attr("stroke-dasharray", lDC.style.strokeDasharray || "")
        .attr("d", linePathSC);
    });
  }

  private updateLowResLinesSC = () => {
    const linesSC = this.prevOutput.dataState.lines.map(lDC => {
      const scales = this.prevOutput.configState.scales
      const numScaleX = ("categories" in scales.x && "category" in lDC && "x" in lDC.category)
        ? scales.x.categories[lDC.category.x]
        : scales.x as ScaleNumeric;
      const numScaleY = ("categories" in scales.y && "category" in lDC && "y" in lDC.category)
        ? scales.y.categories[lDC.category.y]
        : scales.y as ScaleNumeric;

      return lDC.points.map(p => ({ x: numScaleX(p.x), y: numScaleY(p.y) }));
    });
    if (this.options.RDPEpsilon !== null) {
      this.lowResLinesSC = RDPAlgorithm(linesSC, this.options.RDPEpsilon);
    } else {
      this.lowResLinesSC = linesSC;
    }
  };
}
