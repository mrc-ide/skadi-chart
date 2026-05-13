import { ChartType } from "@/types";
import { InteractiveFlags, InteractiveOutput } from "../interactive/types";
import { CoreLayer, VisualLayer } from "../visual/types";

export class End<M, _T extends ChartType, _Flags extends InteractiveFlags> {
  constructor(private interactiveOutput: InteractiveOutput<M>) {
    this.interactiveOutput.baseState.element.childNodes.forEach(n => n.remove());
    this.interactiveOutput.visualState.visualLayers[VisualLayer.Axes]?.draw();
    this.interactiveOutput.baseState.element.append(
      this.interactiveOutput.visualState.coreLayers[CoreLayer.Svg].node()!
    );
  };
}
