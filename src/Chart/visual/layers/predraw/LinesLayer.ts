import { AxisNames, Lines } from "@/Chart/data/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { PredrawLayer, ZoomProperties } from "./PredrawLayer";
import { ScalesLayer } from "./ScalesLayer";
import { ChartConfig, StartEnd } from "@/Chart/axes/types";
import { userAxisToAxPos } from "@/Chart/axes/utils";
import { Point, ScaleNumeric, XY } from "@/types";
import { CurrState as PrevState } from "@/Chart/config/types";
import { doXY, doXYStartEnd, makeObjXYStartEnd } from "@/helpers";
import { doRDP } from "../helpers/rdp";
import { customLineGenerator } from "../helpers/lines";

// The LinesLayer class handles shared lines data depended upon by TracesLayer and AreaLayer.

// TODO: Hook into zooming lifecycle hooks for
// (1) applying RDP algorithm (probably by re-calling updateLowResLinesSC) and
// (2) filtering lines to the visible viewport.
export class LinesLayer extends PredrawLayer {
  private lines: Lines = [];

// The LinesLayer class handles shared lines data and logic depended upon by TracesLayer and AreaLayer.
  private lowResLinesSC: {
    axisNames: AxisNames,
    points: Point[],
  }[] = [];
  private getNewPoint: XY<StartEnd<null | ((coord: number, t: number) => number)>> =
    makeObjXYStartEnd(() => null);
  getNewPointInverse: XY<StartEnd<null | ((coord: number, t: number) => number)>> =
    makeObjXYStartEnd(() => null);

  // Readonly version of linesDC
  get linesDC() {
    return this.lines;
  }

  // Readonly version of lowResLinesSC
  get currLinesSC() {
    return this.lowResLinesSC;
  }

  zoom = async (_zoomProperties: ZoomProperties) => {};

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

      // TODO base the depth of the scale on the first point of the line
      // get rid of scaleNum and instead just use the scale function inside
      // scales layer
      const axisNameX = lDC.axisName?.x || "xBottom";
      const { position: xPos } = userAxisToAxPos(axisNameX);
      const configX = this.prevOutput.chartCfg["x"][xPos];
      const scaleX = this.scalesLayer.scale("x", xPos, ...configX.map(c => c.type));

      const axisNameY = lDC.axisName?.y || "yLeft";
      const { position: yPos } = userAxisToAxPos(axisNameY);
      const configY = this.prevOutput.chartCfg["y"][yPos];
      const scaleY = this.scalesLayer.scale("y", yPos, ...configY.map(c => c.type));
      return {
        axisNames: { x: axisNameX, y: axisNameY },
        points: lDC.points.map(p => ({ x: scaleX(p.x).coord, y: scaleY(p.y).coord })),
      };
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

  beforeZoom = (zoomProperties: ZoomProperties) => {
    doXYStartEnd((ax, pos) => {
      if (!zoomProperties[ax][pos]) return;
      const { scales } = this.scalesLayer;
      const scale = scales[ax][pos].scale as ScaleNumeric;

      // we have to convert the extents to SC from DC to find out what pixel
      // scaling we need
      const newExtentDC = zoomProperties[ax][pos];
      const newExtentSC = [scale(newExtentDC[0]), scale(newExtentDC[1])];

      const oldExtentDC = scale.domain();
      const oldExtentSC = [scale(oldExtentDC[0]), scale(oldExtentDC[1])];

      const scaling = (oldExtentSC[1] - oldExtentSC[0]) / (newExtentSC[1] - newExtentSC[0]);

      // translation to make sure the start of the zoomed in graph is the start of the user
      // brush selection
      const offsetSC = scaling * scale(newExtentDC[0]) - scale(oldExtentDC[0]);
      const scaleRelative = scaling - 1;
      
      // this function gives us the coordinates at any point t (between 0 and 1) of the
      // animation, t = 0 gives the coords of the original trace, t = 1 gives the zoomed
      // in line coordinates
      this.getNewPoint[ax][pos] = (c, t) => c * (t * scaleRelative + 1) - t * offsetSC;

      // this function is helpful to the area layer but convenient to define here.
      // say we start at a number x_0 for time t = 0. At time step t = T, we would
      // get an intermediate point, x_T = getNewPoint(x_0, T). we can apply
      // getNewPointInverse to this intermediate point to get the original point, i.e.
      // getNewPointInverse(x_T, T) = x_0
      this.getNewPointInverse[ax][pos] = (c, t) => (c + t * offsetSC) / (t * scaleRelative + 1);
    });
  };

  afterZoom = () => this.updateLowResLinesSC();

  // d3 feeds this function with t, which goes from 0 to 1 during the animation,
  // with variable jumps based on your ease.
  getNewLineSC = (lineIdx: number, t: number) => {
    const line = this.lowResLinesSC[lineIdx];
    const { position: posX } = userAxisToAxPos(line.axisNames.x);
    const { position: posY } = userAxisToAxPos(line.axisNames.y);
    const getNewPointX = this.getNewPoint["x"][posX];
    const getNewPointY = this.getNewPoint["y"][posY];
    
    let intermediateLineSC: Point[];
    intermediateLineSC = line.points.map(p => {
      return {
        x: getNewPointX ? getNewPointX(p.x, t) : p.x,
        y: getNewPointY ? getNewPointY(p.y, t) : p.y,
      }
    });

    return customLineGenerator(intermediateLineSC, this.prevOutput.baseState.clipPathBounds)
      .join("");
  };
}
