import { ChartType, XY } from "@/types"



export type SingleRange = { start: number, end: number }
export type Rect = XY<SingleRange>
export type Bounds = {
  width: number,
  height: number,
  margin: Rect,
}



export type BaseState = {
  id: string,
  getHtmlId: (key: string) => string,
  element: HTMLDivElement,
  bounds: Bounds,
}

export type BaseOutputs = {
  [K in ChartType]: {
    chartType: K,
    baseState: BaseState,
  }
}

export type BaseOutput = BaseOutputs[ChartType]
