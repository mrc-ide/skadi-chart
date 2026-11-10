import {
  DefaultCurrFlags,
  CurrFlags,
  CurrOutput,
  CurrState,
  This,
  InteractiveLayers,
  InteractiveLayer
} from "./types";
import { End } from "../end/End";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../visual/types";
import { ChartType } from "../axes/types";
import { ZoomLayer } from "./layers/ZoomLayer";

export class Interactive<CType extends ChartType, Flags extends CurrFlags> {
  private interactiveLayers: InteractiveLayers = {
    [InteractiveLayer.Zoom]: null,
  };

  private constructor(private prevOutput: PrevOutput) {};

  static start<CType extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput
  ) {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Interactive<CType, NewFlags>(prevOutput) as This<CType, NewFlags>
  };

  addZoom() {
    this.interactiveLayers[InteractiveLayer.Zoom] = new ZoomLayer(this.prevOutput);
    return this as This<CType, Flags>;
  };

  addTooltips() {
    return this as This<CType, Flags>;
  };

  end() {
    const interactiveState: CurrState = {
      interactiveLayers: this.interactiveLayers
    };
    const output = {
      ...this.prevOutput,
      interactiveState,
    } as CurrOutput;
    return new End<CType, Flags>(output);
  };
}
