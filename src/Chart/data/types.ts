import { ChartType, Point, Prettify, WithExtensions } from "@/types"
import { Data } from "./Data"
import { BaseOutputs } from "../start/types"



export type DataFlags = { hasData: boolean }
export type DefaultDataFlags = Prettify<{ hasData: false }>



export type This<M, T extends ChartType, Flags extends DataFlags> = Data<M, T, Flags>



type LineStyle = {
  strokeColor?: string,
  opacity?: number,
  strokeWidth?: number,
  strokeDasharray?: string,
  fillColor?: string,
  fillOpacity?: number
}
type LineConfigBase<M> = {
  points: Point[],
  style: LineStyle,
  metadata?: M,
  fill?: boolean
}
type ChartTypeToLineConfig<M> = WithExtensions<{
  [K in ChartType]: LineConfigBase<M>
}, ["category"]>
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
} & Point
type ChartTypeToScatterPointConfig<M> = WithExtensions<{
  [K in ChartType]: ScatterPointConfigBase<M>
}, ["category"]>
type ScatterPointConfig<M, T extends ChartType> =
  ChartTypeToScatterPointConfig<M>[T]
export type ScatterPoints<M, T extends ChartType> = ScatterPointConfig<M, T>[];



export type DataState<M, T extends ChartType> = {
  lines: Lines<M, T>,
  scatterPoints: ScatterPoints<M, T>
}

export type DataOutputs<M> = {
  [K in ChartType]: BaseOutputs[K] & { dataState: DataState<M, K> }
}

export type DataOutput<M> = DataOutputs<M>[ChartType]
