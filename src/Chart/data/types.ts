import { Prettify, SkadiPoint } from "@/types"
import { Data } from "./Data"
import { CurrOutputs as PrevOutputs } from "../base/types"
import { ChartType } from "../base/chartTypes"



export type CurrFlags = { hasLines: boolean, hasPoints: boolean }
export type DefaultCurrFlags = Prettify<{ hasLines: false, hasPoints: false }>



export type This<M, T extends ChartType, Flags extends CurrFlags> = Data<M, T, Flags>



type LineStyle = {
  strokeColor?: string,
  opacity?: number,
  strokeWidth?: number,
  strokeDasharray?: string,
  fillColor?: string,
  fillOpacity?: number
}
type LineConfigBase<M> = {
  points: SkadiPoint[],
  style: LineStyle,
  metadata?: M,
  fill?: boolean
}
type ChartTypeToLineConfig<M> = {
  [K in ChartType]: LineConfigBase<M>
}
export type LineConfig<M, T extends ChartType> = ChartTypeToLineConfig<M>[T]
export type Lines<M, T extends ChartType> = LineConfig<M, T>[]



export type ScatterPointStyle = {
  radius?: number,
  color?: string,
  opacity?: number,
}
type ScatterPointConfigBase<M> = {
  style: ScatterPointStyle,
  metadata?: M
} & SkadiPoint
type ChartTypeToScatterPointConfig<M> = {
  [K in ChartType]: ScatterPointConfigBase<M>
}
type ScatterPointConfig<M, T extends ChartType> =
  ChartTypeToScatterPointConfig<M>[T]
export type ScatterPoints<M, T extends ChartType> = ScatterPointConfig<M, T>[];



export type CurrState<M, T extends ChartType> = {
  lines: Lines<M, T>,
  scatterPoints: ScatterPoints<M, T>
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs[K] & { dataState: CurrState<M, K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
