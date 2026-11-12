import { MixNewFlags } from "@/types";
import {
    Bars,
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  Lines,
  ScatterPoints,
  This,
} from "./types";
import { Config } from "../config/Config";
import { CurrOutput as PrevOutput } from "../html/types";
import { ChartType } from "../axes/types";

export class Data<CType extends ChartType, Flags extends CurrFlags> {
  private lines: Lines = [];
  private scatterPoints: ScatterPoints = [];
  private bars: Bars = [];
  
  private constructor(private prevOutput: PrevOutput) {};

  static start = <T extends ChartType>(prevOutput: PrevOutput) => {
    return new Data<T, DefaultCurrFlags>(prevOutput) as This<T, DefaultCurrFlags>;
  };

  registerLines = (lines: Lines) => {
    this.lines.push(...lines);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasLines: true }>;
    return this as This<CType, NewFlags>;
  };

  registerPoints = (scatterPoints: ScatterPoints) => {
    this.scatterPoints.push(...scatterPoints);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasPoints: true }>;
    return this as This<CType, NewFlags>;
  };

  registerBars = (bars: Bars) => {
    this.bars.push(...bars);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasBars: true }>;
    return this as This<CType, NewFlags>;
  };

  startConfig = () => {
    const dataState: CurrState = {
      lines: this.lines,
      scatterPoints: this.scatterPoints,
      bars: this.bars,
    };
    const output = {
      ...this.prevOutput,
      dataState,
    } as CurrOutput;
    return Config.start<CType, Flags>(output);
  };
};
