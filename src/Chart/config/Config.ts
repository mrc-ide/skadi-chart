import { MixNewFlags } from "@/types";
import { mergeGlobalChartArgsAt } from "./utils";
import {
  AxesArgs,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  DomainArgs,
  GlobalTicksArgs,
  LinesArgs,
  This,
  TicksArgs,
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "@/Chart/data/types";
import { Visual } from "../visual/Visual";
import { mergeChartArgs, mergeChartArgsAt } from "./utils";
import { ChartType } from "../axes/types";

export class Config<CType extends ChartType, Flags extends CurrFlags> {
  private lines: LinesArgs = { RDPEpsilon: null };

  private constructor(private prevOutput: PrevOutput) {};

  static start = <CType extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput
  ) => {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Config<CType, NewFlags>(prevOutput) as This<CType, NewFlags>;
  };

  configureLines(linesArgs: LinesArgs) {
    this.lines.RDPEpsilon = linesArgs.RDPEpsilon;
    return this as This<CType, Flags>;
  };

  configureAxes(args: AxesArgs<CType>) {
    mergeChartArgs(this.prevOutput.chartCfg, args);
    return this as This<CType, Flags>;
  };

  configureDomain(args: DomainArgs<CType>) {
    mergeChartArgsAt(this.prevOutput.chartCfg, args, "domain");
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasConfiguredDomain: true }>
    return this as This<CType, NewFlags>;
  };

  configureTicks(args: TicksArgs<CType> | { global: GlobalTicksArgs<CType> }) {
    if ("global" in args) {
      mergeGlobalChartArgsAt(this.prevOutput.chartCfg, args.global, "tick");
    } else {
      mergeChartArgsAt(this.prevOutput.chartCfg, args, "tick");
    }
    return this as This<CType, Flags>;
  };

  startVisual() {
    const configState: CurrState = {
      lines: this.lines,
    };
    const output = {
      ...this.prevOutput,
      configState,
    } as CurrOutput;
    return Visual.start<CType, Flags>(output);
  };
};
