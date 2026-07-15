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
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";
import { defaultTickConfig } from "./ticks";
import { deepAssignRecordIfDefined } from "./utils";

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private axes: AxisConfig["categoricalXY"] = {
    x: { label: { text: "", padding: 50 }, innerPadding: 0.1 },
    y: { label: { text: "", padding: 40 }, innerPadding: 0.1 },
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
    deepAssignRecordIfDefined(this.axes, args);
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
    const configState: CurrState<ChartType> = {
      axes: this.axes,
      categories: this.categories,
      scales: this.scales,
      ticks: this.ticks ?? defaultTickConfig(this.prevOutput),
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };
};
