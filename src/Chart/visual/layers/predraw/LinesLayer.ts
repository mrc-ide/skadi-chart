import { Lines } from "@/Chart/data/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { doXYStartEnd } from "@/helpers";
import { PredrawLayer } from "./PredrawLayer";
import { ScalesLayer } from "./ScalesLayer";
import { ChartConfig } from "@/Chart/axes/types";
import { userAxisToAxPos } from "@/Chart/axes/utils";
import { Point, ScaleNumeric, XY, ZoomProperties } from "@/types";
import { CurrState as PrevState } from "@/Chart/config/types";
import { doXY } from "@/helpers";
import { doRDP } from "../helpers/rdp";
import { customLineGenerator } from "../helpers/lines";

// The LinesLayer class handles shared lines data depended upon by TracesLayer and AreaLayer.

// TODO: Hook into zooming lifecycle hooks for
// (1) applying RDP algorithm (probably by re-calling updateLowResLinesSC) and
// (2) filtering lines to the visible viewport.
export class LinesLayer extends PredrawLayer {
  private lines: Lines = [];

// The LinesLayer class handles shared lines data and logic depended upon by TracesLayer and AreaLayer.
  private lowResLinesSC: Point[][] = [];
  private getNewPoint: null | ((x: number, y: number, t: number) => Point) = null;
  getNewPointInverse: null | ((x: number, y: number, t: number) => Point) = null;

  // Readonly version of linesDC
  get linesDC() {
    return this.lines;
  }

  // Readonly version of lowResLinesSC
  get currLinesSC() {
    return this.lowResLinesSC;
  }

  async zoom(_zoomProperties: ZoomProperties) {};

  constructor(
    private prevOutput: PrevOutput,
    private scalesLayer: ScalesLayer,
  ) {
    super();
    const { dataState, chartCfg } = this.prevOutput;
    this.lines = this.filterLines(dataState.lines, chartCfg);
    this.updateLowResLinesSC();
  };

  // Filter lines to exclude points with values <= 0 on a log axis.
  // If there are points in the line with values <= 0 then we split up the line into
  // segments, missing out the points with values <= 0.
  private filterLines = (lines: Lines, chart: ChartConfig) => {
    // TODO need to refactor once log has been added to options
    return lines;
    // let filteredLines = lines;
    // doXYStartEnd((ax, pos) => {
    //   // TODO add log boolean to structure
    //   // if (!this.prevOutput.configState.scales.config[axis].log) {
    //   //   return;
    //   // }
    //
    //   // log filtering only makes sense for numerical
    //   if (chart[ax][pos].at(-1)!.type !== "numerical") return;
    //
    //   let warningMsg = "";
    //   const segments: Lines = [];
    //   // Here we create a line segment, iterate down its points,
    //   // and once we hit a negative coordinate we push that line segment and start a new one.
    //   for (let i = 0; i < lines.length; i++) {
    //     const currLine = lines[i];
    //     let isLastCoordinatePositive = currLine.points[0]
    //       && (currLine.points[0][axis].at(-1) as number) > 0;
    //     let lineSegment: Lines[number] = { ...currLine, points: [] };
    //
    //     for (let j = 0; j < currLine.points.length; j++) {
    //       const numCoord = currLine.points[j][axis].at(-1) as number;
    //       if (numCoord <= 0) {
    //         warningMsg = `You have tried to use ${axis} axis `
    //           + `log scale but there are traces with `
    //           + `${axis} coordinates that are <= 0`;
    //       }
    //
    //       if (numCoord > 0) {
    //         lineSegment.points.push(currLine.points[j]);
    //         isLastCoordinatePositive = true;
    //       } else if (isLastCoordinatePositive) {
    //         segments.push(lineSegment);
    //         lineSegment = { ...currLine, points: [] };
    //         isLastCoordinatePositive = false;
    //       }
    //     }
    //
    //     if (isLastCoordinatePositive) {
    //       segments.push(lineSegment);
    //     }
    //   }
    //   if (warningMsg) console.warn(warningMsg);
    //   filteredLines = segments;
    // });
    //
    // return filteredLines;
  }

  private updateLowResLinesSC = () => {
    const linesSC = this.linesDC.map(lDC => {
      const { position: xPos } = userAxisToAxPos(lDC.axisName?.x || "xBottom");
      const numScaleX = this.scalesLayer.scaleNum("x", xPos);
      const { position: yPos } = userAxisToAxPos(lDC.axisName?.y || "yLeft");
      const numScaleY = this.scalesLayer.scaleNum("y", yPos);
      return lDC.points.map(p => ({ x: numScaleX(p.x), y: numScaleY(p.y) }));
    });

    // TODO: fix RDP with new data points type
    this.lowResLinesSC = linesSC;
    // const { RDPEpsilon } = this.prevOutput.configState.lines;
    // if (RDPEpsilon === null) {
    //   this.lowResLinesSC = linesSC;
    //   return;
    // }
    // this.lowResLinesSC = linesSC.map(l => {
    //   const slice = [0, l.length - 1] as [number, number];
    //   return doRDP(l, slice, RDPEpsilon);
    // });
  };

  // TODO change so each function is calculated for xy startend
  // zoom layer should check that at least one of the axis is only numerical
  // otherwise zoom makes no sense
  beforeZoom = ({ x: zoomExtentsDCX, y: zoomExtentsDCY }: ZoomProperties) => {
    // const { x: scaleX, y: scaleY }: XY<ScaleNumeric> = (this.prevOutput.configState as PrevState<"default">).scales;
    //
    // // we have to convert the extents to SC from DC to find out what pixel
    // // scaling we need
    // const newExtentXDC = zoomExtentsDCX;
    // const newExtentYDC = zoomExtentsDCY;
    // const newExtentXSC = [scaleX(newExtentXDC[0]), scaleX(newExtentXDC[1])];
    // const newExtentYSC = [scaleY(newExtentYDC[0]), scaleY(newExtentYDC[1])];
    //
    // const oldExtentXDC = scaleX.domain();
    // const oldExtentYDC = scaleY.domain();
    // const oldExtentXSC = [scaleX(oldExtentXDC[0]), scaleX(oldExtentXDC[1])];
    // const oldExtentYSC = [scaleY(oldExtentYDC[0]), scaleY(oldExtentYDC[1])];
    //
    // const scalingX = (oldExtentXSC[1] - oldExtentXSC[0]) / (newExtentXSC[1] - newExtentXSC[0]);
    // const scalingY = (oldExtentYSC[1] - oldExtentYSC[0]) / (newExtentYSC[1] - newExtentYSC[0]);
    //
    // // translation to make sure the start of the zoomed in graph is the start of the user
    // // brush selection
    // const offsetXSC = scalingX * scaleX(newExtentXDC[0]) - scaleX(oldExtentXDC[0]);
    // const offsetYSC = scalingY * scaleY(newExtentYDC[0]) - scaleY(oldExtentYDC[0]);
    //
    // // useful to precompute
    // const scaleRelativeX = scalingX - 1;
    // const scaleRelativeY = scalingY - 1;
    //
    // // this function gives us the coordinates at any point t (between 0 and 1) of the
    // // animation, t = 0 gives the points of the original traces, t = 1 gives the zoomed
    // // in line coordinates
    // this.getNewPoint = (x, y, t) => ({
    //   x: x * (t * scaleRelativeX + 1) - t * offsetXSC,
    //   y: y * (t * scaleRelativeY + 1) - t * offsetYSC
    // });
    // // this function is helpful to the area layer but convenient to define here.
    // // say we start at a point (x_0, y_0) for time t = 0. At time step t = T, we would
    // // get an intermediate point, (x_T, y_T) = getNewPoint(x_0, y_0, T). we can apply
    // // getNewPointInverse to this intermediate point to get the original point, i.e.
    // // getNewPointInverse(x_T, y_T, T) = (x_0, y_0)
    // this.getNewPointInverse = (x, y, t) => ({
    //   x: (x + t * offsetXSC) / (t * scaleRelativeX + 1),
    //   y: (y + t * offsetYSC) / (t * scaleRelativeY + 1)
    // });
  };

  afterZoom = () => this.updateLowResLinesSC();

  // d3 feeds this function with t, which goes from 0 to 1 during the animation,
  // with variable jumps based on your ease.
  getNewLineSC = (lineIdx: number, t: number) => {
    const intermediateLineSC = this.lowResLinesSC[lineIdx].map(({x, y}) => this.getNewPoint!(x, y, t));
    return customLineGenerator(intermediateLineSC, this.prevOutput.baseState.clipPathBounds).join("");
  };
}
