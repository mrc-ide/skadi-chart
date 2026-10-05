import { Lines } from "@/Chart/data/types";
import { DeepWriteable, Point, ZoomProperties } from "@/types";
import { CurrOutputs as PrevOutputs } from "@/Chart/config/types";
import { doXY } from "@/helpers";
import { PredrawLayer } from "./PredrawLayer";
import { Charts, ChartType } from "@/Chart/base/chartTypes";
import { ScalesLayer } from "./ScalesLayer";
import { objKeys } from "@/Chart/config/utils";
import { SingleChartSatisfies } from "@/Chart/base/types";

// The LinesLayer class handles shared lines data depended upon by TracesLayer and AreaLayer.

// TODO: Hook into zooming lifecycle hooks for
// (1) applying RDP algorithm (probably by re-calling updateLowResLinesSC) and
// (2) filtering lines to the visible viewport.
export class LinesLayer<M, T extends ChartType> extends PredrawLayer<M> {
  private lines: Lines<M, T> = [];
  private lowResLinesSC: Point[][] = [];

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
    private prevOutput: PrevOutputs<M>[T],
    private scalesLayer: ScalesLayer<M, T>,
  ) {
    super();
    const { dataState, chart } = this.prevOutput;
    this.lines = this.filterLines(dataState.lines, chart);
    this.updateLowResLinesSC();
  };

  // Filter lines to exclude points with values <= 0 on a log axis.
  // If there are points in the line with values <= 0 then we split up the line into
  // segments, missing out the points with values <= 0.
  private filterLines = (lines: Lines<M, T>, chart: DeepWriteable<Charts[T]>) => {
    let filteredLines = lines;
    doXY((axis) => {
      // TODO add log boolean to structure
      // if (!this.prevOutput.configState.scales.config[axis].log) {
      //   return;
      // }

      // log filtering only makes sense for numerical
      if (chart[axis].axis1.at(-1)!.type !== "numerical") return;

      let warningMsg = "";
      const segments: Lines<M, T> = [];
      // Here we create a line segment, iterate down its points,
      // and once we hit a negative coordinate we push that line segment and start a new one.
      for (let i = 0; i < lines.length; i++) {
        const currLine = lines[i];
        let isLastCoordinatePositive = currLine.points[0]
          && (currLine.points[0][axis].at(-1) as number) > 0;
        let lineSegment: Lines<M, T>[number] = { ...currLine, points: [] };

        for (let j = 0; j < currLine.points.length; j++) {
          const numCoord = currLine.points[j][axis].at(-1) as number;
          if (numCoord <= 0) {
            warningMsg = `You have tried to use ${axis} axis `
              + `log scale but there are traces with `
              + `${axis} coordinates that are <= 0`;
          }

          if (numCoord > 0) {
            lineSegment.points.push(currLine.points[j]);
            isLastCoordinatePositive = true;
          } else if (isLastCoordinatePositive) {
            segments.push(lineSegment);
            lineSegment = { ...currLine, points: [] };
            isLastCoordinatePositive = false;
          }
        }

        if (isLastCoordinatePositive) {
          segments.push(lineSegment);
        }
      }
      if (warningMsg) console.warn(warningMsg);
      filteredLines = segments;
    });
    return filteredLines;
  }

  private updateLowResLinesSC = () => {
    const chart = this.prevOutput.chart as SingleChartSatisfies;
    const numScaleX = this.scalesLayer.scaleNum("x", objKeys(chart.x).at(-1)!);
    const numScaleY = this.scalesLayer.scaleNum("y", objKeys(chart.y).at(-1)!);
    const linesSC = this.linesDC.map(lDC => {
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
}
