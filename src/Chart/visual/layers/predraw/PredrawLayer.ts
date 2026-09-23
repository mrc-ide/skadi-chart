import { ZoomProperties } from "@/types";

export abstract class PredrawLayer<_M> {
  constructor() {};

  // brush lifecycle hooks
  // note: brushEnd is the same as beforeZoom
  brushStart() {};

  // zoom lifecycle hooks
  beforeZoom(_zoomProperties: ZoomProperties) {};
  async zoom(_zoomProperties: ZoomProperties) {};
  afterZoom(_zoomProperties: ZoomProperties | null) {};
};
