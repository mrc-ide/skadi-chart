import { CurrOutput as PrevOutput } from "../axes/types";
import { CurrOutput, CurrState, Bounds, CurrFlags, DefaultCurrFlags, This } from "./types";
import { Data } from "../data/Data";
import { getInner } from "./utils";
import { makeObjXY } from "@/helpers";
import { ChartType } from "../axes/types";
import { MixNewFlags } from "@/types";

const clipPathBuffer = 1; // Add a buffer to the clip path to ensure origin lines and band border lines are not clipped

export class Html<CType extends ChartType, Flags extends CurrFlags> {
  private id: string;
  private getHtmlId: (key: string) => string;
  private element: HTMLDivElement | null = null;
  private bounds: Bounds | null = null;
  private clipPathBounds: Bounds | null = null;

  static start = <CType extends ChartType>(prevOutput: PrevOutput) => {
    return new Html<CType, DefaultCurrFlags>(prevOutput) as This<CType, DefaultCurrFlags>;
  }

  private constructor(private prevOutput: PrevOutput) {
    this.id = Math.random().toString(26).substring(2, 10);
    this.getHtmlId = (key: string) => `${key}-${this.id}`;
  };

  addElement(element: HTMLDivElement) {
    this.element = element;
    const { width, height } = element.getBoundingClientRect();
    const margin = {
      x: { start: 100, end: 100 },
      y: { start: 80, end: 80 },
    }
    this.bounds = { width, height, margin };

    const { x, y } = getInner(this.bounds);
    this.clipPathBounds = {
      width: x.size + clipPathBuffer * 2,
      height: y.size + clipPathBuffer * 2,
      margin: makeObjXY(a => ({
        start: this.bounds!.margin[a].start - clipPathBuffer,
        end: this.bounds!.margin[a].end - clipPathBuffer,
      }))
    };

    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasElement: true }>
    return this as This<CType, NewFlags>;
  };

  startData() {
    const baseState: CurrState = { 
      id: this.id,
      getHtmlId: this.getHtmlId,
      element: this.element!,
      bounds: this.bounds!,
      clipPathBounds: this.clipPathBounds!,
    };
    const output: CurrOutput = {
      ...this.prevOutput,
      baseState
    };
    return Data.start<CType>(output);
  };
}
