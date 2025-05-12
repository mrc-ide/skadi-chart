import { Scales } from "@/Chart";
import * as d3 from "@/d3";

export enum LayerType {
  Svg = "svg",
  ClipPath = "clipPath",
  BaseLayer = "baseLayer",
  Axes = "axes",
  Brush = "brush",
  Trace = "trace",
  Tooltip = "tooltip"
}

export enum CustomEvents {
  BrushStart = "brushstart",
  BrushEnd = "brushend",
  AnimationStart = "animationstart",
  AnimationEnd = "animationend",
}

export type XY<T> = { x: T, y: T }

export type Point = XY<number>

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

export type LayerArgs = {
  // TODO chart id instead
  id: string,
  getHtmlId: (layer: LayerType) => string,
  bounds: Bounds,
  globals: {
    animationDuration: number
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
  optionalLayers: AllOptionalLayers[]
};

export type ZoomExtents = Partial<XY<[number, number]>>

export abstract class OptionalLayer<Properties = null> {
  abstract type: LayerType;
  properties: Properties | null = null;

  constructor() {};

  abstract draw(layerArgs: LayerArgs): void;

  doZoom(zoomExtents: ZoomExtents) {};
};
