import { ChartType } from "@/types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../interactive/types";
import { CoreLayer, VisualLayer } from "../visual/types";

export class End<M, _T extends ChartType, _Flags extends PrevFlags> {
  constructor(private prevOutput: PrevOutput<M>) {
    this.prevOutput.baseState.element.childNodes.forEach(n => n.remove());
    this.prevOutput.visualState.visualLayers[VisualLayer.Axes]?.draw();
    this.prevOutput.visualState.visualLayers[VisualLayer.Trace]?.draw();
    this.prevOutput.baseState.element.append(
      this.prevOutput.visualState.coreLayers[CoreLayer.Svg].node()!
    );
  };
}
