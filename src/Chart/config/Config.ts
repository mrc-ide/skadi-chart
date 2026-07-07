import { ChartType, MixNewFlags } from "@/types";
import {
  AxisArgs,
  AxisConfig,
  Categories,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  TickArgs,
  TickConfig,
  TickConfigNumerical,
  This
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";

const defaultNumericalSpecifier = ".2~s"; // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M

// A responsive default tick count, based on the size (in svg pixels) of the axis's own relevant
// dimension (bounds.width for x, bounds.height for y).
const getDefaultTickCount = (size: number) => {
  if (size < 250) return 3;
  if (size < 450) return 6;
  return 10;
};

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private axes: AxisConfig["categoricalXY"] = {
    x: { label: { text: "", padding: 50 }, innerPadding: 0.1 },
    y: { label: { text: "", padding: 40 }, innerPadding: 0.1 },
  };
  private categories: Categories["categoricalXY"] = { x: [], y: [] };
  private scales: ScaleOutput[ChartType] | null = null;
  private ticks: TickConfig[T];

  private constructor(private prevOutput: PrevOutput<M>) {
    const { bounds } = prevOutput.baseState;
    this.ticks = makeObjXY(axis => {
      const isCategorical = categoricalChartTypes[axis].includes(prevOutput.chartType);
      const numerical: TickConfigNumerical = {
        padding: isCategorical ? 6 : 12,
        size: 0,
        count: getDefaultTickCount(axis === "x" ? bounds.width : bounds.height),
        specifier: defaultNumericalSpecifier,
        enableMathJax: false,
      };
      return isCategorical
        ? { numerical, categorical: { padding: 30, size: 0 } }
        : { numerical };
    }) as TickConfig[T];
  };

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
      if (args[axis] && "innerPadding" in args[axis] && args[axis].innerPadding !== undefined) {
        this.axes[axis].innerPadding = args[axis].innerPadding;
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
    this.scales = processScaleArgs(scaleArgsParsed, this.prevOutput, this.categories, this.axes);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredScale: true }>
    return this as This<M, T, NewFlags>;
  };

  configureTicks(args: TickArgs[T] = {}) {
    doXY(axis => {
      const axisArgs = args[axis];
      if (!axisArgs) return;
      const axisTicks = this.ticks[axis];

      if (axisArgs.numerical) {
        axisTicks.numerical = { ...axisTicks.numerical, ...axisArgs.numerical };
      }
      if ("categorical" in axisArgs && axisArgs.categorical && "categorical" in axisTicks) {
        axisTicks.categorical = { ...axisTicks.categorical, ...axisArgs.categorical };
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
      ticks: this.ticks,
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };
};
