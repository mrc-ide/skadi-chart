import { D3Selection, LayerArgs, Lines, Point, ZoomExtents } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

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

export class TracesLayer extends OptionalLayer {
  type = LayerType.Trace;
  private traces: D3Selection<SVGPathElement>[] = [];
  private lowResLinesSC: Point[][] = [];
  private getNewPoint: null | ((x: number, t: number) => number) = null;

  constructor(public linesDC: Lines) {
    super();
  };

  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease, t = 0 is the start state of
  // your animation, t = 1 is the end state of your animation
  private customTween = (index: number) => {
    const currLineSC = this.lowResLinesSC[index];
    return (t: number) => {
      const intermediateLineSC = currLineSC.map(({x, y}) => {
        return { x: this.getNewPoint!(x, t), y };
      });
      return this.customLineGen(intermediateLineSC);
    };
  };

  private customLineGen = (lineSC: Point[]) => {
    let retStr = "M";
    const { x, y } = lineSC[0];
    retStr += x;
    retStr += ",";
    retStr += y;

    for (let i = 2; i < lineSC.length - 1; i++) {
      const { x, y } = lineSC[i];
      retStr += "L";
      retStr += x;
      retStr += ",";
      retStr += y;
    }

    return retStr;
  };

  private updateLowResLinesSC = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const linesSC = this.linesDC.map(l => {
      return l.points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) }));
    });
    this.lowResLinesSC = RDPAlgorithm(linesSC, 1);
  };

  draw = (layerArgs: LayerArgs) => {
    this.updateLowResLinesSC(layerArgs);

    this.traces = this.linesDC.map((l, index) => {
      const linePathSC = this.customLineGen(this.lowResLinesSC[index]);
      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", "none")
        .attr("stroke", l.style.color || "black")
        .attr("opacity", l.style.opacity || 1)
        .attr("stroke-width", l.style.strokeWidth || 0.5)
        .attr("d", linePathSC);
    });

    this.beforeZoom = (zoomExtentsDC: ZoomExtents) => {
      const newExtentXDC = zoomExtentsDC.x!;
      const { x: scaleX } = layerArgs.scaleConfig.linearScales;
      const oldExtentXDC = scaleX.domain();

      // how much we have to zoom is the same in DC and SC since they are proportional to
      // each other. scale is therefore a variable that isn't in SC or DC, it is coordinate
      // independent
      const scale = (oldExtentXDC[1] - oldExtentXDC[0]) / (newExtentXDC[1] - newExtentXDC[0]);

      // translation to make sure the start of the zoomed in graph is the start of the user
      // brush selection
      const offsetSC = scale * scaleX(newExtentXDC[0]) - scaleX(oldExtentXDC[0]);
      
      // useful to precompute
      const scaleRelative = scale - 1;

      // this function gives us the x coordinate at any point t (between 0 and 1) of the
      // animation, t = 0 gives the x points of the original traces, t = 1 gives the zoomed
      // in line x coordinates
      this.getNewPoint = (x, t) => x * (t * scaleRelative + 1) - t * offsetSC;
    };

    // the zoom layer updates scaleX and scaleY which change our customLineGen function
    this.zoom = async () => {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.linesDC.length; i++) {
        const promise = this.traces[i]
          .transition()
          .duration(layerArgs.globals.animationDuration)
          // we do a custom animation because it is faster than d3's default
          .attrTween("d", () => this.customTween(i))
          .end();
        promises.push(promise);
      };
      await Promise.all(promises);

      // after zoom animation, calculate appropriate resolution lines again and replace
      // without the user knowing
      this.updateLowResLinesSC(layerArgs);
      this.traces.forEach((t, index) => {
        t.attr("d", this.customLineGen(this.lowResLinesSC[index]))
      });
    };
  };
}

