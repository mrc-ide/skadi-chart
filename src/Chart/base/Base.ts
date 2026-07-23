import { ChartType } from "@/types";
import { CurrOutput, CurrState, Bounds } from "./types";
import { Data } from "../data/Data";
import { getInner } from "./utils";

const clipPathBuffer = 1; // Add a buffer to the clip path to ensure origin lines and band border lines are not clipped

export class Base<M, T extends ChartType> {
  private id: string;
  private getHtmlId: (key: string) => string;
  private bounds: Bounds;
  private clipPathBounds: Bounds;

  constructor(private chartType: T, private element: HTMLDivElement) {
    this.id = Math.random().toString(26).substring(2, 10);
    this.getHtmlId = (key: string) => `${key}-${this.id}`;

    const { width, height } = element.getBoundingClientRect();
    const margin = {
      x: { start: 50, end: 20 },
      y: { start: 20, end: 35 },
    }
    this.bounds = { width, height, margin };

    const { x, y } = getInner(this.bounds);
    console.log("y", y);
    this.clipPathBounds = {
      width: x.end - x.start + clipPathBuffer * 2,
      height: y.end - y.start + clipPathBuffer * 2,
      margin: {
        x: {
          start: this.bounds.margin.x.start - clipPathBuffer,
          end: this.bounds.margin.x.end + clipPathBuffer,
        },
        y: {
          start: this.bounds.margin.y.start - clipPathBuffer,
          end: this.bounds.margin.y.end + clipPathBuffer,
        },
      },
    };
  };

  startData() {
    const baseState: CurrState = { 
      id: this.id,
      getHtmlId: this.getHtmlId,
      element: this.element,
      bounds: this.bounds,
      clipPathBounds: this.clipPathBounds,
    };
    const output = {
      chartType: this.chartType,
      baseState,
    } as CurrOutput;
    return Data.start<M, T>(output);
  };
}
