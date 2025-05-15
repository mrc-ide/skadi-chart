import { Lines } from "@/Chart";
import { D3Selection, LayerArgs, LayerType, OptionalLayer, Point, ZoomExtents } from "./Layer";

// see https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Line_defined_by_two_points
const fastPerpendicularDistance = (
  coeff1: number, coeff2: number, coeff3: number, coeff4: number, point: Point
) => {
  return coeff1 * point.x - coeff2 * point.y + coeff3 - coeff4;
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
  sliceStart: number, sliceEnd: number, points: Point[], scaledPoints: Point[], epsilon: number
): Point[] => {
  // raw data points, these coordinates map to the axis coordinates
  const start = points[sliceStart];
  const end = points[sliceEnd];
  
  // these coordinates map to svg coordinates not data coordinates
  const startScaled = scaledPoints[sliceStart];
  const endScaled = scaledPoints[sliceEnd];

  // pre-compute coeficients that'll be used in the for loop for perpendicular
  // distanec calculations
  const coeff1 = endScaled.y - startScaled.y;
  const coeff2 = endScaled.x - startScaled.x;
  const coeff3 = endScaled.x * startScaled.y;
  const coeff4 = endScaled.y * startScaled.x;
  
  // find the point with the maximum distance
  let dMax = 0;
  let index = 0;
  const abs = Math.abs;
  for (let i = sliceStart + 1; i < sliceEnd - 1; i++) {
    const d = abs(fastPerpendicularDistance(coeff1, coeff2, coeff3, coeff4, scaledPoints[i]));
    if (d > dMax) {
      dMax = d;
      index = i;
    }
  }

  // compute denominator once from https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Line_defined_by_two_points
  const dMaxScaled = dMax / Math.sqrt(coeff1 * coeff1 + coeff2 * coeff2);

  // if there is point outside epsilon band repeat, else delete points in a straight line
  if (dMaxScaled > epsilon) {
    const res1 = doRDP(sliceStart, index, points, scaledPoints, epsilon);
    const res2 = doRDP(index, sliceEnd, points, scaledPoints, epsilon);
    return [...res1, ...res2];
  } else {
    return [start, end];
  }
};

const RDPAlgorithm = (lines: Lines, scaledLines: Point[][], epsilon: number) => {
  return lines.map((l, index) => {
    return doRDP(0, l.points.length - 1, l.points, scaledLines[index], epsilon);
  });
};

export class TracesLayer extends OptionalLayer {
  type = LayerType.Trace;
  private traces: D3Selection<SVGPathElement>[] = [];
  private scaledLines: Point[][] = [];
  private lowerResolutionLines: Point[][] = [];
  private parsedDAttribute: (number | string)[][] = [];
  private getNewPoint: null | ((x: number, t: number) => number) = null;

  constructor(public lines: Lines) {
    super();
  };

  private parseDAttributes = () => {
    for (let index = 0; index < this.lines.length; index++) {
      const originalPath = this.traces[index].attr("d").slice(1);
      this.parsedDAttribute[index] = originalPath.split(/L|,/);
      for (let i = 0; i < this.parsedDAttribute[index].length - 1; i += 2) {
        this.parsedDAttribute[index][i] = parseFloat(this.parsedDAttribute[index][i] as string).toFixed(3);
      }
    }
  };

  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease
  private customTween = (index: number) => {
    const getNewPointFunc = this.getNewPoint!;
    return (t: number) => {
      let retStr = "M";
      const newPoint = getNewPointFunc(this.parsedDAttribute[index][0] as number, t);
      retStr += newPoint + "," + this.parsedDAttribute[index][1];

      for (let i = 2; i < this.parsedDAttribute[index].length - 1; i += 2) {
        const newPoint = getNewPointFunc(this.parsedDAttribute[index][i] as number, t);
        retStr += "L";
        retStr += newPoint;
        retStr += ",";
        retStr += this.parsedDAttribute[index][i + 1];
      }

      return retStr;
    };
  };

  draw = (layerArgs: LayerArgs) => {
    // using scaleX to compute the svg coordinates from data coordinates is
    // expensive so do it once at the beginning
    if (this.scaledLines.length === 0) {
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      this.scaledLines = this.lines.map(l => {
        return l.points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) }));
      });
    }

    this.lowerResolutionLines = RDPAlgorithm(this.lines, this.scaledLines, 1);
    
    this.traces = this.lines.map((l, index) => {
      const linePath = layerArgs.scaleConfig.lineGen(this.lowerResolutionLines[index]);
      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("vector-effect", "non-scaling-stroke")
        .attr("fill", "none")
        .attr("stroke", l.style.color || "black")
        .attr("opacity", l.style.opacity || 1)
        .attr("stroke-width", l.style.strokeWidth || 0.5)
        .attr("d", linePath);
    });

    // for performance we manually implement x axis zoom and to do so we have
    // to parse the d attribute of the path element and convert the string to
    // float, however parse float is expensive so do it upfront rather than
    // during the animation
    this.parseDAttributes();

    this.beforeZoom = (zoomExtents: ZoomExtents) => {
      const newExtentX = zoomExtents.x!;
      const { x: scaleX } = layerArgs.scaleConfig.linearScales;
      const oldExtentX = scaleX.domain();

      const scale = (oldExtentX[1] - oldExtentX[0]) / (newExtentX[1] - newExtentX[0]);
      const offset = scale * scaleX(newExtentX[0]) - scaleX(oldExtentX[0]);
      const scaleRelative = scale - 1;
      this.getNewPoint = (x, t) => x * (t * scaleRelative + 1) - t * offset;
    };

    this.zoom = async () => {
      const promises: Promise<void>[] = [];
      for (let index = 0; index < this.lines.length; index++) {
        const promise = this.traces[index]
          .transition()
          .duration(layerArgs.globals.animationDuration)
          // we do a custom animation because it is faster than d3's
          // default
          .attrTween("d", () => this.customTween(index))
          .end();
        promises.push(promise);
      };
      await Promise.all(promises);

      this.lowerResolutionLines = RDPAlgorithm(this.lines, this.scaledLines, 1);
      this.lines.forEach((_l, index) => {
        const newLinePath = layerArgs.scaleConfig.lineGen(this.lowerResolutionLines[index]);
        this.traces[index]
          .attr("d", newLinePath);
      });

      this.parseDAttributes();
    };
  };
}

