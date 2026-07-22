import { Layer } from "./Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayers } from "../types";


export class TracesLayer<M> extends Layer<M, null> {
  private zoomCallbacks: (() => Promise<void>)[] = [];
  
  constructor(
    private prevOutput: PrevOutput<M>,
    private coreLayers: CoreLayers,
  ) {
    super();
  };

  zoom = async () => {
    // Implementation for zooming traces goes here
  }
  
  draw = () => {
    // Implementation for drawing traces goes here
  }
}
