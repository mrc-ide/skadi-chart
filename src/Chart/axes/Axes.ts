import { MixNewFlags } from "@/types";
import {
  ChartConfig,
  ChartType,
  CurrAxis,
  CurrFlags,
  DefaultChartType,
  DefaultCurrFlags,
  MixNewChartType,
  NumericalOn,
  This,
  CurrOutput,
  CurrAxisNoNone
} from "./types";
import { chartCfgDefs } from "./defaults";
import { Base } from "../base/Base";
import { deepCopy, userAxisToAxPos } from "./utils";

export class Axes<Flags extends CurrFlags, CType extends ChartType> {
  private currAxis: CurrAxis = "none";
  private chartCfg: ChartConfig = {
    x: { start: [], end: [] },
    y: { start: [], end: [] },
  };

  private constructor() {};

  static start = () => {
    return new Axes<DefaultCurrFlags, DefaultChartType>() as
      This<DefaultCurrFlags, DefaultChartType>;
  };


  xBottom = () => {
    this.currAxis = "xBottom";
    type NewFlags = MixNewFlags<CurrFlags, Flags, { axis: "xBottom" }>
    return this as This<NewFlags, CType>;
  };
  xTop = () => {
    this.currAxis = "xTop";
    type NewFlags = MixNewFlags<CurrFlags, Flags, { axis: "xTop" }>
    return this as This<NewFlags, CType>;
  };
  yLeft = () => {
    this.currAxis = "yLeft";
    type NewFlags = MixNewFlags<CurrFlags, Flags, { axis: "yLeft" }>
    return this as This<NewFlags, CType>;
  };
  yRight = () => {
    this.currAxis = "yRight";
    type NewFlags = MixNewFlags<CurrFlags, Flags, { axis: "yRight" }>
    return this as This<NewFlags, CType>;
  };


  categorical = () => {
    const { axis, position } = userAxisToAxPos(this.currAxis as CurrAxisNoNone);
    this.chartCfg[axis][position].push(deepCopy(chartCfgDefs["categorical"]));

    type NewChartType = MixNewChartType<Flags, CType, "categorical">
    return this as This<Flags, NewChartType>
  };
  numerical = () => {
    const { axis, position } = userAxisToAxPos(this.currAxis as CurrAxisNoNone);
    this.chartCfg[axis][position].push(deepCopy(chartCfgDefs["numerical"]));

    type NewChartType = MixNewChartType<Flags, CType, "numerical">
    type NewFlags = NumericalOn<Flags>
    return this as This<NewFlags, NewChartType>
  };


  startHtml = () => {
    const output: CurrOutput = {
      chartCfg: this.chartCfg
    };
    return Base.start<CType>(output);
  }
};
