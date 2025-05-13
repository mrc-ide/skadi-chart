import { Scales } from "@/Chart";
import * as d3 from "@/d3";

/*
  These are the various different types of layer types
  that we can have, some are optional layers (created
  if the user wishes) and some are core layers that are
  created in the initialiser of the Chart class
*/
export enum LayerType {
  Svg = "svg",
  ClipPath = "clipPath",
  BaseLayer = "baseLayer",
  Axes = "axes",
  Brush = "brush",
  Trace = "trace",
  Tooltip = "tooltip"
}

/*
  We need some custom events so that layers can listen
  to events (such as turning off tooltips when brushing).
  To keep it simple, all these events will be
  dispatched on the svg element
*/
export enum CustomEvents {
  ZoomStart = "zoomstart",
  ZoomEnd = "zoomend",
}

export type XY<T> = { x: T, y: T }

export type Point = XY<number>

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

  doZoom(_zoomExtents: ZoomExtents) {};
};
