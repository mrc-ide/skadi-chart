import { ChartType, MixNewFlags } from "@/types";
import {
  DataFlags,
  DataOutput,
  DataState,
  DefaultDataFlags,
  Lines,
  ScatterPoints,
  This,
} from "./types";
import { Config } from "../config/Config";
import { BaseOutput } from "../start/types";

export class Data<M, T extends ChartType, Flags extends DataFlags> {
  private lines: Lines<M, T> = [];
  private scatterPoints: ScatterPoints<M, T> = [];
  
  constructor(private baseOutput: BaseOutput) {};

  static start = <M, T extends ChartType>(baseOutput: BaseOutput) => {
    return new Data<M, T, DefaultDataFlags>(baseOutput) as This<M, T, DefaultDataFlags>;
  };

  registerLines = (lines: Lines<M, T>) => {
    this.lines.push(...lines);
    type NewFlags = MixNewFlags<DataFlags, Flags, { hasData: true }>;
    return this as This<M, T, NewFlags>;
  };

  registerPoints = (scatterPoints: ScatterPoints<M, T>) => {
    this.scatterPoints.push(...scatterPoints);
    type NewFlags = MixNewFlags<DataFlags, Flags, { hasData: true }>;
    return this as This<M, T, NewFlags>;
  };

  startConfig = () => {
    const dataState: DataState<M, ChartType> = {
      lines: this.lines,
      scatterPoints: this.scatterPoints,
    };
    const output = {
      ...this.baseOutput,
      dataState,
    } as DataOutput<M>;
    return Config.start<M, T, Flags>(output);
  };
};
