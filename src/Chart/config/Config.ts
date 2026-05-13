import { ChartType, MixNewFlags } from "@/types";
import {
    Categories,
  ConfigFlags,
  ConfigOutput,
  ConfigState,
  DefaultConfigFlags,
  This
} from "./types";
import { DataFlags, DataOutput } from "../data/types";
import { Visual } from "../visual/Visual";
import { processScaleArgs, ScaleArgs, ScaleOutput } from "./scales";

export class Config<M, T extends ChartType, Flags extends ConfigFlags> {
  private scales: ScaleOutput[ChartType] | null = null;
  private categories: Categories["categoricalXY"] = { x: ["_"], y: ["_"] };

  private constructor(private dataOutput: DataOutput<M>) {};

  static start = <M, T extends ChartType, PrevFlags extends DataFlags>(
    dataOutput: DataOutput<M>
  ) => {
    type NewFlags = DefaultConfigFlags<PrevFlags>
    return new Config<M, T, NewFlags>(dataOutput) as This<M, T, NewFlags>;
  };

  configureCategories(args: Categories[T]) {
    if ("x" in args && args.x.length > 0) {
      this.categories.x = args.x;
    }
    if ("y" in args && args.y.length > 0) {
      this.categories.y = args.y;
    }
    type NewFlags = MixNewFlags<ConfigFlags, Flags, { hasConfiguredCategories: true }>
    return this as This<M, T, NewFlags>;
  };

  configureScales(scaleArgs: ScaleArgs) {
    this.scales = processScaleArgs(scaleArgs, this.dataOutput, this.categories);
    type NewFlags = MixNewFlags<ConfigFlags, Flags, { hasConfiguredScale: true }>
    return this as This<M, T, NewFlags>;
  };

  startVisual() {
    if (!this.scales) {
      throw new Error("Scales must be configured before going into startVisual")
    }
    const configState: ConfigState<ChartType> = {
      scales: this.scales,
      categories: this.categories
    };
    const output = {
      ...this.dataOutput,
      configState,
    } as ConfigOutput<M>;
    return Visual.start<M, T, Flags>(output);
  };
};
