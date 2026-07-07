import { ChartType, MixNewFlags } from "@/types";
import {
  AxisArgs,
  AxisConfig,
  CategoriesArgs,
  CategoriesConfig,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  This,
  TicksArgs,
  TicksConfig,
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../data/types";
import { Visual } from "../visual/Visual";
import { categoricalChartTypes, processScaleArgs, ScaleArgs, ScaleArgsParsed, ScaleOutput } from "./scales";
import { doXY, makeObjXY } from "@/helpers";

export class Config<M, T extends ChartType, Flags extends CurrFlags> {
  private axes: AxisConfig = { x: { label: { text: "", padding: 50 } }, y: { label: { text: "", padding: 40 } } };
  private categories: CategoriesConfig["categoricalXY"] = { x: { labels: [], innerPadding: 0.1 }, y: { labels: [], innerPadding: 0.1 } };
  private scales: ScaleOutput[ChartType] | null = null;
  private ticks: TicksConfig["categoricalXY"] = makeObjXY(axis => ({
    numerical: {
      padding: 6,
      size: 0,
      // The x axis's tick density is bounded by available width, y's by available height.
      count: this.getAutoNumericalTickCount(axis === "x" ? this.prevOutput.baseState.bounds.width : this.prevOutput.baseState.bounds.height),
      specifier: ".2~s",
      enableMathJax: false,
    },
    categorical: {
      padding: 30,
      size: 0,
    },
  }));

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
        if (args[axis].label.padding !== undefined) {
          this.axes[axis].label.padding = args[axis].label.padding;
        }
      }
    });
    return this as This<M, T, Flags>;
  }

  configureCategories(args: CategoriesArgs[T]) {
    doXY(axis => {
      if (axis in args) {
        const { labels, innerPadding } = (args as CategoriesArgs["categoricalXY"])[axis];
        if (labels.length > 0) {
          this.categories[axis].labels = labels;
          if (innerPadding !== undefined) {
            this.categories[axis].innerPadding = innerPadding;
          }
        }
      }
    });
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredCategories: true }>
    return this as This<M, T, NewFlags>;
  };

  configureScales(scaleArgs: ScaleArgs = {}) {
    doXY(axis => {
      if (categoricalChartTypes[axis].includes(this.prevOutput.chartType) && !this.categories[axis].labels.length) {
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

  // Width/height-based default numerical tick count, resolved here (in the Config stage, where
  // bounds are already known) so that Visual/AxesLayer never needs to know about this responsive-
  // default logic and always sees an already-resolved concrete count.
  private getAutoNumericalTickCount(sizePx: number): number {
    if (sizePx < 250) return 3;
    if (sizePx < 450) return 6;
    return 10;
  }

  configureTicks(args: TicksArgs[T] = {}) {
    doXY(axis => {
      const axisArgs = (args as TicksArgs["categoricalXY"])[axis];
      if (!axisArgs) return;

      if (axisArgs.numerical) {
        this.ticks[axis].numerical = { ...this.ticks[axis].numerical, ...axisArgs.numerical };
      }
      if (axisArgs.categorical) {
        this.ticks[axis].categorical = { ...this.ticks[axis].categorical, ...axisArgs.categorical };
      }
    });
    return this as This<M, T, Flags>;
  };

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
