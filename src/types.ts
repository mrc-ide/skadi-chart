import { ChartOptions } from "./Chart";
import * as d3 from "./d3";
import { LayerType, OptionalLayer } from "./layers/Layer";



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
