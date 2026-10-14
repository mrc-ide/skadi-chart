import { Layer } from "@/Chart/visual/layers/Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { D3Selection } from "@/types";
import { customLineGenerator } from "./utils";
import { LinesLayer } from "./predraw/LinesLayer";

export class TracesLayer extends Layer {
  private zoomCallbacks: (() => Promise<void>)[] = [];
  private traces: D3Selection<SVGPathElement>[] = [];
  
  constructor(
    private prevOutput: PrevOutput,
    private coreLayers: CoreLayers,
    private linesLayer: LinesLayer,
  ) {
    super();
  };

  zoom = async () => {
    // Implementation for zooming traces goes here
  }
  
  draw = () => {
    const { getHtmlId } = this.prevOutput.baseState;

    this.traces = this.linesLayer.linesDC.map((lDC, index) => {
      const linePathSC = customLineGenerator(this.linesLayer.currLinesSC[index], this.prevOutput.baseState.clipPathBounds).join("");
      return this.coreLayers[CoreLayer.BaseLayer].append("path")
        .attr("id", `${getHtmlId(VisualLayer.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", "none")
        .attr("stroke", lDC.style.strokeColor || "black")
        .attr("opacity", lDC.style.opacity || 1)
        .attr("stroke-width", lDC.style.strokeWidth || 0.5)
        .attr("stroke-dasharray", lDC.style.strokeDasharray || "")
        .attr("d", linePathSC);
    });
  };
}
