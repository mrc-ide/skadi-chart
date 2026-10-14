import { ChartType } from "../axes/types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../interactive/types";
import { CoreLayer, VisualLayer } from "../visual/types";

export class End<_CType extends ChartType, _Flags extends PrevFlags> {
  constructor(private prevOutput: PrevOutput) {
    this.prevOutput.baseState.element.childNodes.forEach(n => n.remove());
    this.prevOutput.visualState.visualLayers[VisualLayer.Axes]?.draw();
    this.prevOutput.visualState.visualLayers[VisualLayer.Trace]?.draw();
    this.prevOutput.baseState.element.append(
      this.prevOutput.visualState.coreLayers[CoreLayer.Svg].node()!
    );
  };
}
