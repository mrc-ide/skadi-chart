import { Lines } from "@/Chart/data/types";
import { LifecycleHooks } from "@/Chart/visual/layers/Layer";
import { ChartType, ZoomProperties } from "@/types";
import { CurrOutputs as PrevOutputs } from "@/Chart/config/types";
import { doXY } from "@/helpers";

// The LinesLayer class handles shared lines data depended upon by TracesLayer and AreaLayer.

// TODO: Hook into zooming lifecycle hooks for
// (1) applying RDP algorithm and
// (2) filtering lines to the visible viewport.
export class LinesLayer<M, T extends ChartType> implements Partial<LifecycleHooks> {
  private linesDC: Lines<M, T> = [];

  // Readonly version of linesDC
  get lines() {
    return this.linesDC;
  }

  async zoom(_zoomProperties: ZoomProperties) {};

  constructor(private prevOutput: PrevOutputs<M>[T]) {
    this.linesDC = this.filterLines(this.prevOutput.dataState.lines);
  };

  // Filter lines to exclude points with values <= 0 on a log axis.
  // If there are points in the line with values <= 0 then we split up the line into
  // segments, missing out the points with values <= 0.
  private filterLines = (lines: Lines<M, T>) => {
    let filteredLines = lines;
    doXY((axis) => {
      if (!this.prevOutput.configState.scales.config[axis].log) {
        return;
      }
      let warningMsg = "";
      const segments: Lines<M, T> = [];
      // Here we create a line segment, iterate down its points,
      // and once we hit a negative coordinate we push that line segment and start a new one.
      for (let i = 0; i < lines.length; i++) {
        const currLine = lines[i];
        let isLastCoordinatePositive = currLine.points[0] && currLine.points[0][axis] > 0;
        let lineSegment: Lines<M, T>[number] = { ...currLine, points: [] };

        for (let j = 0; j < currLine.points.length; j++) {
          if (currLine.points[j][axis] <= 0) {
            warningMsg = `You have tried to use ${axis} axis `
              + `log scale but there are traces with `
              + `${axis} coordinates that are <= 0`;
          }

          if (currLine.points[j][axis] > 0) {
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
}
