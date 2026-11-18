import { ChartType } from "../axes/types";
import { ScaleNumeric, XorY, ZoomExtents, ZoomProperties } from "@/types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../interactive/types";
import { CoreLayer, PredrawLayer, VisualLayer } from "../visual/types";

export class End<_CType extends ChartType, _Flags extends PrevFlags> {
  constructor(private prevOutput: PrevOutput) {
    this.prevOutput.baseState.element.childNodes.forEach(n => n.remove());
    const { visualLayers } = this.prevOutput.visualState;
    const { interactiveLayers } = this.prevOutput.interactiveState;
    Object.values(visualLayers).forEach(l => l?.draw());
    Object.values(interactiveLayers).forEach(l => l?.draw());
    this.prevOutput.baseState.element.append(
      this.prevOutput.visualState.coreLayers[CoreLayer.Svg].node()!
    );
  };
}
