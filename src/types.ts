import { ChartOptions } from "./Chart";
import * as d3 from "./d3";
import { LayerType, OptionalLayer } from "./layers/Layer";

export type XY<T> = { x: T, y: T }

export type Point = XY<number>

export type XYLabel = Partial<XY<string>>

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

export type D3Selection<Element extends d3.BaseType> = d3.Selection<Element, Point, null, undefined>

export type AllOptionalLayers = OptionalLayer<any>;

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
  globals: {
    animationDuration: number,
    ticks: XY<number>
  },
  scaleConfig: {
    linearScales: XY<d3.ScaleLinear<number, number, never>>,
    scaleExtents: Scales,
    lineGen: d3.Line<Point>
  },
  coreLayers: {
    [LayerType.Svg]: D3Selection<SVGSVGElement>,
    [LayerType.ClipPath]: D3Selection<SVGClipPathElement>,
    [LayerType.BaseLayer]: D3Selection<SVGGElement>,
  },
  optionalLayers: AllOptionalLayers[],
  chartOptions: ChartOptions
};

export type ZoomExtents = Partial<XY<[number, number]>>
export type Scales = XY<{ start: number, end: number }>
export type PartialScales = Partial<XY<{ start?: number, end?: number }>>

type LineConfig = {
  points: Point[],
  style: {
    color?: string,
    opacity?: number,
    strokeWidth?: number
    strokeDasharray?: string
  }
}
export type Lines = LineConfig[]

type ScatterPointConfig = {
  x: number,
  y: number,
  style: {
    radius?: number,
    color?: string,
    opacity?: number
  }
}
export type ScatterPoints = ScatterPointConfig[];
