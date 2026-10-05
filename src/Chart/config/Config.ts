import { MixNewFlags } from "@/types";
import {
    AxesArgs,
  Categories,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  DomainArgs,
  LinesArgs,
  This,
  TicksArgs,
} from "./types";
import { TickArgs } from "./ticks";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "@/Chart/data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";
import { defaultTickConfig } from "./ticks";
import { deepAssignRecordIfDefined, mergeChartArgs, objForEach } from "./utils";
import { ChartType } from "../base/chartTypes";
import { SingleChartSatisfies } from "../base/types";

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private lines: LinesArgs = { RDPEpsilon: null };

  private constructor(private prevOutput: PrevOutput<M>) {};

  static start = <M, T extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput<M>
  ) => {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Config<M, T, NewFlags>(prevOutput) as This<M, T, NewFlags>;
  };

  configureLines(linesArgs: LinesArgs) {
    this.lines.RDPEpsilon = linesArgs.RDPEpsilon;
    return this as This<M, T, Flags>;
  };

  configureAxes(args: AxesArgs<T>) {
    mergeChartArgs(this.prevOutput.chart, args);
    return this as This<M, T, Flags>;
  };

  configureDomain(args: DomainArgs<T>) {
    mergeChartArgs(this.prevOutput.chart, args);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredDomain: true }>
    return this as This<M, T, NewFlags>;
  };

  configureTicks(args: TicksArgs<T>) {
    mergeChartArgs(this.prevOutput.chart, args);
    doXY(axis => {
      const chartAxis = this.prevOutput.chart[axis] as SingleChartSatisfies["x"];
      objForEach(chartAxis, (_, levels) => {
        const lastLevel = levels.at(-1);
        if (
          lastLevel && lastLevel.type === "numerical"
          && lastLevel.tick.enableMathJax && !lastLevel.tick.formatter
        ) {
          throw new Error("When MathJax is enabled, a formatter must be provided.");
        }
      });
    });
    return this as This<M, T, Flags>;
  };

  // configureScales(scaleArgs: ScaleArgs = {}) {
  //   doXY(axis => {
  //     if (categoricalChartTypes[axis].includes(this.prevOutput.chartType) && !this.categories[axis].length) {
  //       throw new Error("Categories must be configured before scales")
  //     }
  //   });
  //   const scaleArgsParsed: ScaleArgsParsed =
  //     makeObjXY(() => ({ extents: { start: "auto", end: "auto" } }));
  //   deepAssignRecordIfDefined(scaleArgsParsed, scaleArgs);
  //   this.scales = processScaleArgs(scaleArgsParsed, this.prevOutput, this.categories, this.axes);
  //   type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredScale: true }>
  //   return this as This<M, T, NewFlags>;
  // };

  startVisual() {
    const configState: CurrState = {
      lines: this.lines,
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };
};
