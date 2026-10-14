import { CurrOutput as PrevOutput } from "../axes/types";
import { Prettify, XY } from "@/types"
import { Base } from "./Base"
import { ChartType } from "../axes/types"



export type CurrFlags = { hasElement: boolean }
export type DefaultCurrFlags = Prettify<{ hasElement: false }>
type AllMethods = keyof Base<any, any>
type Method<M extends AllMethods> = M



type BlockIfNoElem<Flags extends CurrFlags> =
  Flags["hasElement"] extends false ? Method<"startData"> : ""
type MethodsToRemove<Flags extends CurrFlags> = 
  | BlockIfNoElem<Flags>

export type This<CType extends ChartType, Flags extends CurrFlags> =
  Omit<Base<CType, Flags>, MethodsToRemove<Flags>>



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

export type CurrOutput = {
  baseState: CurrState
} & PrevOutput
