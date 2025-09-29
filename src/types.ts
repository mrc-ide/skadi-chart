import { ChartOptions } from "./Chart";
import * as d3 from "./d3";
import { LayerType, OptionalLayer } from "./layers/Layer";

export type XY<T> = { x: T, y: T }
export type Point = XY<number>
export type PointWithMetadata<Metadata> = Point & { metadata?: Metadata }
export type BandPoint<Metadata> = PointWithMetadata<Metadata> & { bands: Partial<XY<string>> }

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
    tickConfig: XY<{ count: number, specifier?: string }>;
  },
  scaleConfig: {
    linearScales: XY<d3.ScaleLinear<number, number, never>>,
    scaleExtents: Scales,
    categoricalScales: Partial<XY<d3.ScaleBand<string>>>,
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
  color?: string,
  opacity?: number,
  strokeWidth?: number
  strokeDasharray?: string
}
export type LineConfig<Metadata> = {
  points: Point[],
  style: LineStyle,
  metadata?: Metadata,
  bands?: Partial<XY<string>>
}
export type Lines<Metadata> = LineConfig<Metadata>[]

export type ScatterPointStyle = {
  radius?: number,
  color?: string,
  opacity?: number,
}
type ScatterPointConfig<Metadata> = {
  x: number,
  y: number,
  style: ScatterPointStyle,
  metadata?: Metadata
}
export type ScatterPoints<Metadata> = ScatterPointConfig<Metadata>[];
