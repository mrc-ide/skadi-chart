import { ZoomProperties } from "@/types";

export abstract class Layer<_M, Returns = null> {
  returns: Returns | null = null;

  constructor() {};

  abstract draw(): void;

  // brush lifecycle hooks
  // note: brushEnd is the same as beforeZoom
  brushStart() {};

  // zoom lifecycle hooks
  beforeZoom(_zoomProperties: ZoomProperties) {};
  async zoom(_zoomProperties: ZoomProperties) {};
  afterZoom(_zoomProperties: ZoomProperties | null) {};
};

export type LifecycleHooks = Omit<Layer<any>, "returns" | "draw">;
