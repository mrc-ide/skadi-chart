import { StartEnd } from "@/Chart/axes/types"
import { XY } from "@/types"

export type ZoomExtents = XY<StartEnd<[number, number] | null>>
export type ZoomProperties = ZoomExtents & { eventType: "brush" | "dblclick" }

export abstract class PredrawLayer {
  constructor() {};

  // brush lifecycle hooks
  // note: brushEnd is the same as beforeZoom
  brushStart() {};

  // zoom lifecycle hooks
  beforeZoom(_zoomProperties: ZoomProperties) {};
  zoom = async (_zoomProperties: ZoomProperties): Promise<void> => {};
  afterZoom(_zoomProperties: ZoomProperties | null) {};
};
