import { ChartType, XY } from "@/types"



export type SingleRange = { start: number, end: number }
export type Rect = XY<SingleRange>
export type Bounds = {
  width: number,
  height: number,
  margin: Rect,
}



export type CurrState = {
  id: string,
  getHtmlId: (key: string) => string,
  element: HTMLDivElement,
  bounds: Bounds,
  clipPathBounds: Bounds,
}

export type CurrOutputs = {
  [K in ChartType]: {
    chartType: K,
    baseState: CurrState,
  }
}

export type CurrOutput = CurrOutputs[ChartType]
