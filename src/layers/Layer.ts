import { LayerArgs, ZoomExtents } from "@/types";

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
  Zoom = "zoom",
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

export abstract class OptionalLayer<Properties = null> {
  abstract type: LayerType;
  properties: Properties | null = null;

  constructor() {};

  abstract draw(layerArgs: LayerArgs): void;

  // zoom lifecycle hooks
  beforeZoom(_zoomExtents: ZoomExtents) {};
  async zoom(_zoomExtents: ZoomExtents) {};
};
