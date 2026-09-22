import { ChartType, MixNewFlags } from "@/types";
import {
  AxisArgs,
  AxisConfig,
  Categories,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  This,
} from "./types";
import { TickArgs, TickConfig } from "./ticks";
import { Lines, CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "@/Chart/data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";
import { defaultTickConfig } from "./ticks";
import { deepAssignRecordIfDefined } from "./utils";

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private axes: AxisConfig["categoricalXY"] = {
    x: { label: { text: "", padding: 50 }, innerPadding: 0.1, drawOrigin: true },
    y: { label: { text: "", padding: 40 }, innerPadding: 0.1, drawOrigin: true },
  };
  private categories: Categories["categoricalXY"] = { x: [], y: [] };
  private scales: ScaleOutput[ChartType] | null = null;
  private ticks: TickConfig[ChartType] | null = null;

  private constructor(private prevOutput: PrevOutput<M>) {};

  static start = <M, T extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput<M>
  ) => {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Config<M, T, NewFlags>(prevOutput) as This<M, T, NewFlags>;
  };

  configureAxes(args: AxisArgs[T] = {}) {
    doXY(axis => {
      if (args[axis]?.label) {
        this.axes[axis].label.text = args[axis].label.text;
        if (args[axis].label.padding !== undefined) {
          this.axes[axis].label.padding = args[axis].label.padding;
        }
      }
      if (args[axis]?.drawOrigin !== undefined) {
        this.axes[axis].drawOrigin = args[axis].drawOrigin!;
      }
      if (args[axis] && "innerPadding" in args[axis] && args[axis].innerPadding !== undefined) {
        this.axes[axis].innerPadding = args[axis].innerPadding;
      }
    });
    return this as This<M, T, Flags>;
  }

  configureCategories(args: Categories[T]) {
    deepAssignRecordIfDefined(this.categories, args);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredCategories: true }>
    return this as This<M, T, NewFlags>;
  };

  configureScales(scaleArgs: ScaleArgs = {}) {
    doXY(axis => {
      if (categoricalChartTypes[axis].includes(this.prevOutput.chartType) && !this.categories[axis].length) {
        throw new Error("Categories must be configured before scales")
      }
    });
    const scaleArgsParsed: ScaleArgsParsed =
      makeObjXY(() => ({ extents: { start: "auto", end: "auto" } }));
    deepAssignRecordIfDefined(scaleArgsParsed, scaleArgs);
    this.scales = processScaleArgs(scaleArgsParsed, this.prevOutput, this.categories, this.axes);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredScale: true }>
    return this as This<M, T, NewFlags>;
  };

  configureTicks(tickArgs: TickArgs[T]) {
    this.ticks ??= defaultTickConfig(this.prevOutput);
    deepAssignRecordIfDefined(this.ticks, tickArgs);
    doXY((axis) => {
      if (this.ticks?.[axis].numerical.enableMathJax && !this.ticks?.[axis].numerical.formatter) {
        throw new Error("When MathJax is enabled, a formatter must be provided.");
      }
    });
    return this as This<M, T, Flags>;
  }

  startVisual() {
    if (!this.scales) {
      throw new Error("Scales must be configured before going into startVisual")
    }

    // TODO: move this (and the linesDC prop) to its own dedicated Lines layer
    const filteredLines = this.filterLines(this.prevOutput.dataState.lines);

    const configState: CurrState<M, ChartType> = {
      axes: this.axes,
      categories: this.categories,
      linesDC: filteredLines,
      scales: this.scales,
      ticks: this.ticks ?? defaultTickConfig(this.prevOutput),
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };

  // Filter lines to exclude points with values <= 0 on a log axis.
  // If there are points in the line with values <= 0 then we split up the line into
  // segments, missing out the points with values <= 0.
  private filterLines = (lines: Lines<M, ChartType>) => {
    let filteredLines = lines;
    doXY((axis) => {
      if (!this.scales) {
        // TODO: This check won't be needed once we have a Lines layer
        throw new Error("Scales must be configured before filtering lines")
      }
      if (!this.scales.config[axis].log) {
        return;
      }
      let warningMsg = "";
      const segments: Lines<M, ChartType> = [];
      // Here we create a line segment, iterate down its points,
      // and once we hit a negative coordinate we push that line segment and start a new one.
      for (let i = 0; i < lines.length; i++) {
        const currLine = lines[i];
        let isLastCoordinatePositive = currLine.points[0] && currLine.points[0][axis] > 0;
        let lineSegment: Lines<M, ChartType>[number] = { ...currLine, points: [] };

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
};
