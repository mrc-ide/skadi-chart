import { ChartOptions } from "./Chart";
import * as d3 from "./d3";
import { LayerType, OptionalLayer } from "./layers/Layer";

export type AxisType = 'x' | 'y';
export type XY<T> = Record<AxisType, T>;
export type Point = XY<number>
export type PointWithMetadata<Metadata> = Point & {
  metadata?: Metadata,
  bands?: Partial<XY<string>>
}

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
export type ClipPathBounds = Partial<Omit<Bounds, "margin">> & { margin?: Partial<Bounds["margin"]> }

export type D3Selection<Element extends d3.BaseType> = d3.Selection<Element, Point, null, undefined>

export type AllOptionalLayers = OptionalLayer<any>;

export type ScaleNumeric = d3.ScaleContinuousNumeric<number, number, never>
export type CategoricalScaleConfig = {
  main: d3.ScaleBand<string>, // The main categorical scale
  bands: Record<string, ScaleNumeric> // Numerical scales within each category for banded data
}
export type TickConfig = { count: number, specifier?: string, padding?: number, size?: number };

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
    tickConfig: XY<TickConfig>;
  },
  scaleConfig: {
    linearScales: XY<ScaleNumeric>,
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
