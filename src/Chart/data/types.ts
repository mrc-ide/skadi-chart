import { Prettify, SkadiPoint } from "@/types"
import { Data } from "./Data"
import { CurrOutput as PrevOutput } from "../html/types"
import { ChartType, ExtendsAxis } from "../axes/types"



export type CurrFlags = { hasLines: boolean, hasPoints: boolean }
export type DefaultCurrFlags = Prettify<{ hasLines: false, hasPoints: false }>



export type This<T extends ChartType, Flags extends CurrFlags> = Data<T, Flags>



type LineStyle = {
  strokeColor?: string,
  opacity?: number,
  strokeWidth?: number,
  strokeDasharray?: string,
  fillColor?: string,
  fillOpacity?: number
}
type LineConfig = {
  points: SkadiPoint[],
  style: LineStyle,
  metadata?: any,
  fill?: boolean,
  axisName?: Partial<{
    x: ExtendsAxis<"xBottom" | "xTop">,
    y: ExtendsAxis<"yLeft" | "yRight">,
  }>,
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



export type CurrState = {
  lines: Lines,
  scatterPoints: ScatterPoints
}

export type CurrOutput = {
  dataState: CurrState
} & PrevOutput
