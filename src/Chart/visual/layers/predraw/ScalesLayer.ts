import * as d3 from "@/d3";
import { ChartType } from "@/Chart/base/chartTypes";
import { PredrawLayer } from "./PredrawLayer";
import { CurrOutput as PrevOutputs } from "@/Chart/config/types";
import { AxisConfiguration, SingleChartSatisfies } from "@/Chart/base/types";
import { ScaleCategorical, ScaleNumeric, SkadiPoint, XorY, XY, ZoomProperties } from "@/types";
import { getInner } from "@/Chart/base/utils";
import { doXY, makeObjXY } from "@/helpers";
import { objForEach, objMap } from "@/Chart/config/utils";

export type Scales =
  | { scale: ScaleNumeric }
  | {
    scale: ScaleCategorical,
    categories: Record<string, Scales>
  }
  
export type CatScales = Extract<Scales, { scale: ScaleCategorical }>
export type NumScales = Extract<Scales, { scale: ScaleNumeric }>

export class ScalesLayer<M, _T extends ChartType> extends PredrawLayer<M> {
  scales: XY<Record<string, Scales>>;

  constructor(private prevOutputs: PrevOutputs<M>) {
    super();
    const { x, y } = getInner(prevOutputs.baseState.bounds);
    const ranges = {
      x: [x.start, x.end],
      y: [y.end, y.start],
    };
    this.scales = makeObjXY(axis => {
      return objMap(
        prevOutputs.chart[axis],
        k => k,
        (_, cfgArr) => this.makeScaleFromChartArray(cfgArr, ranges[axis]),
      );
    });
  };

  zoom(zoomProperties: ZoomProperties) {
    doXY(axis => {
      if (zoomProperties[axis]) {
        const axisLevels = this.prevOutputs.chart[axis];
        objForEach(axisLevels, (axisName, cfgArr) => {
          if (cfgArr.length === 1 && cfgArr[0].type === "numerical") {
            this.scales[axis][axisName].scale.domain(zoomProperties[axis]);
          }
        });
      }
    });
  };

  scale(
    axis: XorY,
    axisName: "axis1" | "axis2",
    ...args: AxisConfiguration["type"][]
  ) {
    const nestedScale = this.scales[axis][axisName];
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
          ret = currS(p as string)! + currS.bandwidth() / 2;
          currScale = currScale.categories[p];
        } else if (args[i] === "numerical") {
          ret = (currScale.scale as ScaleNumeric)(p as number);
        }
      });

      return ret;
    };
  };

  scaleNum(axis: XorY, axisName: "axis1" | "axis2") {
    const config = (this.prevOutputs.chart as SingleChartSatisfies)[axis][axisName];
    if (!config) throw new Error(`axisName, "${axisName}", does not exist`);

    const lastCfg = config.at(-1)!;
    if (lastCfg.type !== "numerical") throw new Error("Numerical scale does not exist");

    return this.scale(axis, axisName, ...config.map(c => c.type));
  };

  private makeScaleFromChartArray(
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
          .range(range);

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
