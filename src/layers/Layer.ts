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
  Tooltip = "skadi-chart-tooltip",
  Grid = "grid",
  Scatter = "scatter",
  Custom = "custom",
}

export abstract class OptionalLayer<Properties = null> {
  abstract type: LayerType;
  properties: Properties | null = null;

  constructor() {};

  abstract draw(layerArgs: LayerArgs): void;

  // brush lifecycle hooks
  // note: brushEnd is the same as beforeZoom
  brushStart() {};

  // zoom lifecycle hooks
  beforeZoom(_zoomExtents: ZoomExtents) {};
  async zoom(_zoomExtents: ZoomExtents) {};
  afterZoom(_zoomExtents: ZoomExtents | null) {};
};

export type LifecycleHooks = Omit<OptionalLayer, "type" | "properties" | "draw">;
