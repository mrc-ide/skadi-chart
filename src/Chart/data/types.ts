import { Prettify, SkadiPoint } from "@/types"
import { Data } from "./Data"
import { CurrOutput as PrevOutput } from "../html/types"
import { AxisName, ChartType, ExtendsAxis } from "../axes/types"



export type CurrFlags = {
  hasLines: boolean,
  hasPoints: boolean,
  hasBars: boolean,
}
export type DefaultCurrFlags = Prettify<{
  hasLines: false,
  hasPoints: false,
  hasBars: false,
}>



export type This<T extends ChartType, Flags extends CurrFlags> = Data<T, Flags>



type LineStyle = {
  strokeColor?: string,
  opacity?: number,
  strokeWidth?: number,
  strokeDasharray?: string,
  fillColor?: string,
  fillOpacity?: number
}
export type AxisNames = {
  x: ExtendsAxis<"xBottom" | "xTop">,
  y: ExtendsAxis<"yLeft" | "yRight">,
}
type LineConfig = {
  points: SkadiPoint[],
  style: LineStyle,
  metadata?: any,
  fill?: boolean,
  axisName?: Partial<AxisNames>,
}
export type Lines = LineConfig[]



export type ScatterPointStyle = {
  radius?: number,
  color?: string,
  opacity?: number,
}
type ScatterPointConfig = {
  style: ScatterPointStyle,
  metadata?: any
} & SkadiPoint
export type ScatterPoints = ScatterPointConfig[];


export type BarStyle = {
  color?: string,
  opacity?: number,
}
type BarConfig = {
  metadata?: any,
  baseAxis: AxisName,
  valueAxis: AxisName,
  base: string[],
  stack: {
    range: number[],
    style: BarStyle,
  }[]
}
export type Bars = BarConfig[];



export type CurrState = {
  lines: Lines,
  scatterPoints: ScatterPoints,
  bars: Bars,
}

export type CurrOutput = {
  dataState: CurrState
} & PrevOutput
