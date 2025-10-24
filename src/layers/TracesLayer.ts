import { D3Selection, LayerArgs, Lines, LineConfig, Point, ZoomExtents, ScaleNumeric, XY } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { numScales } from "@/helpers";
import { customLineGen } from "@/helpers";

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

export class TracesLayer<Metadata> extends OptionalLayer {
  type = LayerType.Trace;
  private traces: D3Selection<SVGPathElement>[] = [];
  lowResLinesSC: Point[][] = [];
  getNewPoint: null | ((x: number, y: number, t: number) => Point) = null;
  getNewPointInverse: null | ((x: number, y: number, t: number) => Point) = null;

  constructor(public linesDC: Lines<Metadata>, public options: TracesOptions) {
    super();
  };

  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease, t = 0 is the start state of
  // your animation, t = 1 is the end state of your animation
  private customTween = (index: number, zoomExtents: ZoomExtents) => {
    const currLineSC = this.lowResLinesSC[index];
    return (t: number) => {
      const intermediateLineSC = currLineSC.map(({x, y}) => this.getNewPoint!(x, y, t));
      return customLineGen(intermediateLineSC, zoomExtents).join("");
    };
  };

  private updateLowResLinesSC = (layerArgs: LayerArgs) => {
    const { linearScales, categoricalScales } = layerArgs.scaleConfig;
    const linesSC = this.linesDC.map(l => {
      const scales = numScales(l.bands, layerArgs);
      return l.points.map(p => ({ x: scales.x(p.x), y: scales.y(p.y) }));
    });
    if (this.options.RDPEpsilon !== null) {
      this.lowResLinesSC = RDPAlgorithm(linesSC, this.options.RDPEpsilon);
    } else {
      this.lowResLinesSC = linesSC;
    }
  };

  draw = (layerArgs: LayerArgs, currentExtentsDC: ZoomExtents) => {
    this.updateLowResLinesSC(layerArgs);
    const { linearScales, categoricalScales } = layerArgs.scaleConfig;

    this.traces = this.linesDC.map((l, index) => {
      const scales = numScales(l.bands, layerArgs);

      const currentExtentsSC: ZoomExtents = {
        x: [scales.x(currentExtentsDC.x[0]), scales.x(currentExtentsDC.x[1])],
        y: [scales.y(currentExtentsDC.y[0]), scales.y(currentExtentsDC.y[1])],
      };

      const linePathSC = customLineGen(this.lowResLinesSC[index], currentExtentsSC).join("");
      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", "none")
        .attr("stroke", l.style.strokeColor || "black")
        .attr("opacity", l.style.opacity || 1)
        .attr("stroke-width", l.style.strokeWidth || 0.5)
        .attr("stroke-dasharray", l.style.strokeDasharray || "")
        .attr("d", linePathSC);
    });

    this.beforeZoom = (zoomExtentsDC: ZoomExtents) => {
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;

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
      const scaleRelativeX = scalingX - 1;
      const scaleRelativeY = scalingY - 1;

      // this function gives us the x coordinate at any point t (between 0 and 1) of the
      // animation, t = 0 gives the x points of the original traces, t = 1 gives the zoomed
      // in line x coordinates
      this.getNewPoint = (x, y, t) => ({
        x: x * (t * scaleRelativeX + 1) - t * offsetXSC,
        y: y * (t * scaleRelativeY + 1) - t * offsetYSC
      });
      this.getNewPointInverse = (x, y, t) => ({
        x: (x + t * offsetXSC) / (t * scaleRelativeX + 1),
        y: (y + t * offsetYSC) / (t * scaleRelativeY + 1)
      });
    };

    // the zoom layer updates scaleX and scaleY which change our customLineGen function
    this.zoom = async zoomExtentsDC => {
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      const zoomExtentsSC: ZoomExtents = {
        x: [scaleX(zoomExtentsDC.x[0]), scaleX(zoomExtentsDC.x[1])],
        y: [scaleY(zoomExtentsDC.y[0]), scaleY(zoomExtentsDC.y[1])],
      };

      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.linesDC.length; i++) {
        const promise = this.traces[i]
          .transition()
          .duration(layerArgs.globals.animationDuration)
          // we do a custom animation because it is faster than d3's default
          .attrTween("d", () => this.customTween(i, zoomExtentsSC))
          .end();
        promises.push(promise);
      };
      await Promise.all(promises);

      // after zoom animation, calculate appropriate resolution lines again and replace
      // without the user knowing
      this.updateLowResLinesSC(layerArgs);
      this.traces.forEach((t, index) => {
        t.attr("d", customLineGen(this.lowResLinesSC[index], zoomExtentsSC).join(""))
      });
    };
  };
}

