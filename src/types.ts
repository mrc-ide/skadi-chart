import { ChartOptions } from "./Chart";
import * as d3 from "./d3";
import { LayerType, OptionalLayer } from "./layers/Layer";

type Axess = "categorical"[]
  | [..."categorical"[], "numerical"]
const chartTypeObj = {
  x: ["categorical", "categorical", "numerical"],
  y: ["numerical"]
} as const satisfies XY<Axess>

type PointType<T extends Axess> =
  T extends "categorical"[] ? string[] :
  T extends ["numerical"] ? number[] :
  (string | number)[]

type Point2 = {
  x: PointType<(typeof chartTypeObj)["x"]>,
  y: PointType<(typeof chartTypeObj)["y"]>
}
const p: Point2 = {
  x: ["foo", 2],
  y: [2]
}

// Probably put this with the chatTypeObj and also need to include
// visibility of scale
const ranges2 = {
  x: [
    ["A", "B", "C"],
    ["X", "Y", "Z"],
    [0, 100],
  ],
  y: [
    [-500, 500]
  ]
}


type ChartObj = XY<{
  type: "categorical" | "numerical",
  domain: string[] | number[],
  show: boolean
}[]>

export const chartObj = {
  x: {
    shared: [
      {
        type: "categorical",
        domain: ["A", "B", "C"],
        show: true
      },
      {
        type: "categorical",
        domain: ["X", "Y", "Z"],
        show: true
      }
    ],
    shared2: {
      axisLevels: [
        {
          type: "categorical",
          domain: ["A", "B", "C"],
          show: true
        },
        {
          type: "categorical",
          domain: ["X", "Y", "Z"],
          show: true
        }
      ]
    },
  },
  y: {
    bar: [
      {
        type: "numerical",
        domain: [-500, 500],
        show: true
      }
    ],
    trace: [
      {
        type: "numerical",
        domain: [0, 100],
        show: true
      }
    ]
  },
};



export class Scales2 {
  scaleXY: XY<any>
  constructor(chartObj: ChartObj) {
    this.scaleXY = {
      x: this.makeScaleFromChartArray(chartObj.x),
      y: this.makeScaleFromChartArray(chartObj.y),
    };
    console.log(this.scaleXY);
  }

  private makeScaleFromChartArray(arr: ChartObj["x"]) {
    const recurse = (
      remainingArr: ChartObj["x"],
      scaleObj: Record<string, any>,
      range: number[]
    ) => {
      const firstEl = remainingArr.at(0);
      if (firstEl?.type === "numerical") {
        scaleObj.scale = d3.scaleLinear()
          .domain(firstEl.domain as number[])
          .range(range);
      } else if (firstEl?.type === "categorical") {
        const categoricalScale = d3.scaleBand()
          .domain(firstEl.domain as string[])
          .range(range);
        scaleObj.scale = categoricalScale;
        scaleObj.categories = {};
        const width = categoricalScale.bandwidth();
        categoricalScale.domain().forEach(c => {
          const start = categoricalScale(c)!;
          const range = [start, start + width];
          scaleObj.categories[c] = {};
          recurse(
            remainingArr.slice(1),
            scaleObj.categories[c],
            range
          );
        });
      }
    };

    const ret = {};
    recurse(arr, ret, [0, 9000]);
    return ret;
  }

  scale(...args: string[]) {
    const scaleXOrY = (this.scaleXY as any)[args[0]];
    return (point: (string | number)[]) => {
      let currScaleObj = scaleXOrY;
      let ret = 0;
      point.forEach((p, idx) => {
        if (args[idx + 1] === "categorical") {
          const currScale = currScaleObj.scale as d3.ScaleBand<string>;
          ret = currScale(p as string)! + currScale.bandwidth() / 2;
          currScaleObj = currScaleObj.categories[p];
        } else if (args[idx + 1] === "numerical") {
          ret = (currScaleObj.scale as ScaleNumeric)(p as number);
        }
      });
      return ret;
    }
  }
};



export type XorY = 'x' | 'y';
export type XY<T> = Record<XorY, T>;
export type Point = XY<number>
export type SkadiPoint = XY<(string | number)[]>



export type CategoricalChartType = "categoricalX" | "categoricalY" | "categoricalXY"
export type ChartType = "default" | CategoricalChartType



export type HasAllKeys<
  Keys extends string | number | symbol,
  T extends Record<Keys, any>
> = T

export type DeepPartialRecord<T extends Record<string, unknown>> = {
  [K in keyof T]?: T[K] extends Function
    ? T[K]
    : T[K] extends Record<string, unknown>
      ? DeepPartialRecord<T[K]>
      : T[K];
};

export type DeepWriteable<T> = Prettify<{ -readonly [P in keyof T]: DeepWriteable<T[P]> }>;



export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type ValidateNewFlags<FlagsType, F extends Partial<FlagsType>> = {
  [K in keyof F]: K extends keyof FlagsType ? true : false
}[keyof F] extends true ? true : false

type Mix<O1, O2> = Prettify<{
  [K in keyof O1]: K extends keyof O2 ? O2[K] : O1[K]
}>

export type MixNewFlags<
  FlagsType,
  Flags extends FlagsType,
  F extends Partial<FlagsType>
> = Prettify<
  ValidateNewFlags<FlagsType, F> extends true ? Mix<Flags, F> : {}
>



export type AxisType = 'x' | 'y';

export type PointWithMetadata<Metadata> = Point & {
  metadata?: Metadata,
  bands?: Partial<XY<string>>
}

/*
  These are bounds of the svg element
*/
export type Bounds = {
  width: number,
  height: number,
  margin: {
    top: number, bottom: number,
    left: number, right: number
  }
}
export type ClipPathBounds = Partial<Omit<Bounds, "margin">> & { margin?: Partial<Bounds["margin"]> }

export type D3Selection<Element extends d3.BaseType> = d3.Selection<Element, Point, null, undefined>

export type AllOptionalLayers = OptionalLayer<any>;

export type ScaleNumeric = d3.ScaleContinuousNumeric<number, number, never>
export type ScaleCategorical = d3.ScaleBand<string>

/*
  LayerArgs are passed into each Layer in the draw
  function. This happens at the last step when users
  append the svg to a base element
*/
export type LayerArgs = {
  // TODO chart id instead
  id: string,
  getHtmlId: (layer: LayerType) => string,
  bounds: Bounds,
  clipPathBounds: Bounds,
  globals: {
    animationDuration: number,
    tickConfig: {
      numerical: XY<TickConfig<number>>,
      categorical: XY<TickConfig<string>>,
    },
  },
  scaleConfig: {
    numericalScales: XY<ScaleNumeric>,
    scaleExtents: Scales,
    categoricalScales: Partial<XY<CategoricalScaleConfig>>,
  },
  coreLayers: {
    [LayerType.Svg]: D3Selection<SVGSVGElement>,
    [LayerType.ClipPath]: D3Selection<SVGClipPathElement>,
    [LayerType.BaseLayer]: D3Selection<SVGGElement>,
  },
  optionalLayers: AllOptionalLayers[],
  chartOptions: ChartOptions
};

export type ZoomExtents = XY<[number, number]>
export type ZoomProperties = ZoomExtents & { eventType: "brush" | "dblclick" }
export type Scales = XY<{ start: number, end: number }>
export type PartialScales = Partial<XY<{ start?: number, end?: number }>>

export type LineStyle = {
  strokeColor?: string,
  opacity?: number,
  strokeWidth?: number,
  strokeDasharray?: string,
  fillColor?: string,
  fillOpacity?: number
}
export type LineConfig<Metadata> = {
  points: Point[],
  style: LineStyle,
  metadata?: Metadata,
  bands?: Partial<XY<string>>,
  fill?: boolean
}
export type Lines<Metadata> = LineConfig<Metadata>[]

export type ScatterPointStyle = {
  radius?: number,
  color?: string,
  opacity?: number,
}
type ScatterPointConfig<Metadata> = PointWithMetadata<Metadata> & {
  style: ScatterPointStyle,
}
export type ScatterPoints<Metadata> = ScatterPointConfig<Metadata>[];
