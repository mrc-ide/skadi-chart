import { CoreLayers, PredrawLayers } from "../types";
import { Layer } from "./Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { ZoomProperties } from "./predraw/PredrawLayer";

type DrawCallback = (
  prevOutput: PrevOutput,
  coreLayers: CoreLayers,
  predrawLayers: PredrawLayers,
) => void

type BrushStartCallback = (
  prevOutput: PrevOutput,
  coreLayers: CoreLayers,
  predrawLayers: PredrawLayers,
) => void

type BeforeZoomCallback = (
  zoomProperties: ZoomProperties,
  prevOutput: PrevOutput,
  coreLayers: CoreLayers,
  predrawLayers: PredrawLayers,
) => void

type ZoomCallback = (
  zoomProperties: ZoomProperties,
  prevOutput: PrevOutput,
  coreLayers: CoreLayers,
  predrawLayers: PredrawLayers,
) => Promise<void>

type AfterZoomCallback = (
  zoomProperties: ZoomProperties | null,
  prevOutput: PrevOutput,
  coreLayers: CoreLayers,
  predrawLayers: PredrawLayers,
) => void

export type CustomHooks = {
  drawHook: DrawCallback[],
  bushStartHook: BrushStartCallback[],
  beforeZoomHook: BeforeZoomCallback[],
  zoomHook: ZoomCallback[],
  afterZoomHook: AfterZoomCallback[],
}

export type CustomHookArgs = {
  [K in keyof CustomHooks]?: CustomHooks[K][number]
}

export class CustomLayer extends Layer {
  constructor(
    private prevOutput: PrevOutput,
    private coreLayers: CoreLayers,
    private predrawLayers: PredrawLayers,
    private customHooks: CustomHooks,
  ) {
    super();
  };

  draw = () => {
    this.customHooks.drawHook.forEach(fn => fn(
      this.prevOutput, this.coreLayers, this.predrawLayers
    ));
  };

  brushStart = () => {
    this.customHooks.bushStartHook.forEach(fn => fn(
      this.prevOutput, this.coreLayers, this.predrawLayers
    ));
  };

  beforeZoom = (zoomProperties: ZoomProperties) => {
    this.customHooks.beforeZoomHook.forEach(fn => fn(
      zoomProperties, this.prevOutput, this.coreLayers, this.predrawLayers
    ));
  };

  zoom = async (zoomProperties: ZoomProperties) => {
    const promises = this.customHooks.zoomHook.map(fn => fn(
      zoomProperties, this.prevOutput, this.coreLayers, this.predrawLayers
    ));
    await Promise.all(promises);
  };

  afterZoom = (zoomProperties: ZoomProperties | null) => {
    this.customHooks.afterZoomHook.forEach(fn => fn(
      zoomProperties, this.prevOutput, this.coreLayers, this.predrawLayers
    ));
  };
}
