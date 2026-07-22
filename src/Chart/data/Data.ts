import { ChartType, MixNewFlags } from "@/types";
import {
  CurrFlags,
  CurrOutput,
  CurrState,
  DefaultCurrFlags,
  Lines,
  ScatterPoints,
  This,
} from "./types";
import { Config } from "../config/Config";
import { CurrOutput as PrevOutput } from "../base/types";

export class Data<M, T extends ChartType, Flags extends CurrFlags> {
  private lines: Lines<M, T> = [];
  private scatterPoints: ScatterPoints<M, T> = [];
  
  private constructor(private prevOutput: PrevOutput) {};

  static start = <M, T extends ChartType>(prevOutput: PrevOutput) => {
    return new Data<M, T, DefaultCurrFlags>(prevOutput) as This<M, T, DefaultCurrFlags>;
  };

  registerLines = (lines: Lines<M, T>) => {
    this.lines.push(...lines);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasData: true }>;
    return this as This<M, T, NewFlags>;
  };

  registerPoints = (scatterPoints: ScatterPoints<M, T>) => {
    this.scatterPoints.push(...scatterPoints);
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasData: true }>;
    return this as This<M, T, NewFlags>;
  };

  startConfig = () => {
    const dataState: CurrState<M, ChartType> = {
      lines: this.lines,
      scatterPoints: this.scatterPoints,
    };
    const output = {
      ...this.prevOutput,
      dataState,
    } as CurrOutput<M>;
    return Config.start<M, T, Flags>(output);
  };
};
