import { ChartType, MixNewFlags } from "@/types";
import {
  AxisArgs,
  AxisConfig,
  Categories,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  This
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private axes: AxisConfig = { x: { label: { text: "", padding: 50 } }, y: { label: { text: "", padding: 40 } } };
  private categories: Categories["categoricalXY"] = { x: [], y: [] };
  private scales: ScaleOutput[ChartType] | null = null;

  private constructor(private prevOutput: PrevOutput<M>) {};

  static start = <M, T extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput<M>
  ) => {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Config<M, T, NewFlags>(prevOutput) as This<M, T, NewFlags>;
  };

  configureAxes(args: AxisArgs = {}) {
    doXY(axis => {
      if (args[axis]?.label) {
        this.axes[axis].label.text = args[axis].label.text;
        if (args[axis].label.padding) {
          this.axes[axis].label.padding = args[axis].label.padding;
        }
      }
    });
    return this as This<M, T, Flags>;
  }

  configureCategories(args: Categories[T]) {
    if ("x" in args && args.x.length > 0) {
      this.categories.x = args.x;
    }
    if ("y" in args && args.y.length > 0) {
      this.categories.y = args.y;
    }
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
    doXY(axis => {
      if (scaleArgs && scaleArgs[axis]?.extents?.start) {
        scaleArgsParsed[axis].extents.start = scaleArgs[axis].extents.start;
      }
      if (scaleArgs && scaleArgs[axis]?.extents?.end) {
        scaleArgsParsed[axis].extents.end = scaleArgs[axis].extents.end;
      }
    });
    this.scales = processScaleArgs(scaleArgsParsed, this.prevOutput, this.categories);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredScale: true }>
    return this as This<M, T, NewFlags>;
  };

  startVisual() {
    if (!this.scales) {
      throw new Error("Scales must be configured before going into startVisual")
    }
    const configState: CurrState<ChartType> = {
      axes: this.axes,
      categories: this.categories,
      scales: this.scales,
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };
};
