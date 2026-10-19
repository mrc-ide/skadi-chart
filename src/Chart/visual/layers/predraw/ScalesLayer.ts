import * as d3 from "@/d3";
import { PredrawLayer } from "./PredrawLayer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { ScaleCategorical, ScaleNumeric, SkadiPoint, XorY, XY, ZoomProperties } from "@/types";
import { getInner } from "@/Chart/html/utils";
import { doXYStartEnd, makeObjXYStartEnd } from "@/helpers";
import { AxisConfiguration, AxisType, StartEnd, StartOrEnd } from "@/Chart/axes/types";

export type Scales =
  | { scale: ScaleNumeric }
  | {
    scale: ScaleCategorical,
    categories: Record<string, Scales>
  }
  
export type CatScales = Extract<Scales, { scale: ScaleCategorical }>
export type NumScales = Extract<Scales, { scale: ScaleNumeric }>

export class ScalesLayer extends PredrawLayer {
  scales: XY<StartEnd<Scales>>;

  constructor(private prevOutput: PrevOutput) {
    super();
    const { x, y } = getInner(prevOutput.baseState.bounds);
    const ranges = {
      x: [x.start, x.end],
      y: [y.end, y.start],
    };
    this.scales = makeObjXYStartEnd((ax, pos) => {
      return this.makeScalesFromChartArray(prevOutput.chartCfg[ax][pos], ranges[ax]);
    });
  };

  zoom(zoomProperties: ZoomProperties) {
    doXYStartEnd((ax, pos) => {
      if (!zoomProperties[ax]) return;
      
      const cfgArr = this.prevOutput.chartCfg[ax][pos];
      if (cfgArr.length === 1 && cfgArr[0].type === "numerical") {
        this.scales[ax][pos].scale.domain(zoomProperties[ax]);
      }
    });
  };

  scale(ax: XorY, pos: StartOrEnd, ...args: AxisType[]) {
    const nestedScale = this.scales[ax][pos];
    if (!nestedScale) throw new Error("Scale does not exist");

    return (point: SkadiPoint["x"]) => {
      let currScale = nestedScale;
      let ret = 0;

      // TODO: need one time error checking for points so that they match
      // configuration
      point.forEach((p, i) => {
        if (args[i] === "categorical") {
          if (!("categories" in currScale)) throw new Error("Scale is not categorical");
          const currS = currScale.scale as d3.ScaleBand<string>;
          // TODO does this work for y axis? or is it reversed
          ret = currS(p as string)! + currS.bandwidth() / 2;
          currScale = currScale.categories[p];
        } else if (args[i] === "numerical") {
          ret = (currScale.scale as ScaleNumeric)(p as number);
        }
      });

      return ret;
    };
  };

  // TODO: this doesnt need to exist if traces layer is fully generic
  scaleNum(ax: XorY, pos: StartOrEnd) {
    const config = this.prevOutput.chartCfg[ax][pos];

    const lastCfg = config.at(-1)!;
    if (lastCfg.type !== "numerical") throw new Error("Numerical scale does not exist");

    return this.scale(ax, pos, ...config.map(c => c.type));
  };

  private makeScalesFromChartArray(
    arr: AxisConfiguration[],
    initialRange: number[],
  ): Scales {
    const recurse = (
      remainingArr: AxisConfiguration[],
      scales: Scales,
      range: number[],
    ) => {
      if (remainingArr.length === 0) return;
      const firstEl = remainingArr[0];

      if (firstEl.type === "numerical") {
        scales.scale = d3.scaleLinear()
          .domain(firstEl.domain)
          .range(range);
      } else if (firstEl.type === "categorical") {
        const categoricalScale = d3.scaleBand()
          .domain(firstEl.domain)
          .range(range)
          .paddingInner(firstEl.innerPadding);

        const catScales = scales as CatScales;
        catScales.scale = categoricalScale;
        catScales.categories = {}
        const width = categoricalScale.bandwidth();
        categoricalScale.domain().forEach(c => {
          const start = categoricalScale(c)!;
          const range = [start, start + width];
          catScales.categories[c] = {} as any;
          recurse(remainingArr.slice(1), catScales.categories[c], range);
        });
      }
    };

    const ret = {} as Scales;
    recurse(arr, ret, initialRange);
    return ret;
  };
}
