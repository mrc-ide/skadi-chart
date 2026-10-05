import { ZoomProperties } from "@/types";

export abstract class PredrawLayer<_M> {
  constructor() {};

  // brush lifecycle hooks
  // note: brushEnd is the same as beforeZoom
  brushStart() {};

  // zoom lifecycle hooks
  beforeZoom(_zoomProperties: ZoomProperties) {};
  zoom(_zoomProperties: ZoomProperties): Promise<void> | void {};
  afterZoom(_zoomProperties: ZoomProperties | null) {};
};
