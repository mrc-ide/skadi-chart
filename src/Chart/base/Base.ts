import { ChartType } from "@/types";
import { CurrOutput, CurrState, Bounds } from "./types";
import { Data } from "../data/Data";

export class Base<M, T extends ChartType> {
  private id: string;
  private getHtmlId: (key: string) => string;
  private bounds: Bounds;

  constructor(private chartType: T, private element: HTMLDivElement) {
    this.id = Math.random().toString(26).substring(2, 10);
    this.getHtmlId = (key: string) => `${key}-${this.id}`;

    const { width, height } = element.getBoundingClientRect();
    const margin = {
      x: { start: 50, end: 20 },
      y: { start: 20, end: 35 },
    }
    this.bounds = {
      width, height, margin,
    };
  };

  startData() {
    const baseState: CurrState = { 
      id: this.id,
      getHtmlId: this.getHtmlId,
      element: this.element,
      bounds: this.bounds,
    };
    const output = {
      chartType: this.chartType,
      baseState,
    } as CurrOutput;
    return Data.start<M, T>(output);
  };
}
