import { Layer } from "@/Chart/visual/layers/Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ChartType, D3Selection, Point } from "@/types";
import { customLineGenerator } from "./helpers/lines";
import { LinesLayer } from "./predraw/LinesLayer";

export class TracesLayer<M> extends Layer<M> {
  private traces: D3Selection<SVGPathElement>[] = [];
  
  constructor(
    private prevOutput: PrevOutput<M>,
    private coreLayers: CoreLayers,
    private linesLayer: LinesLayer<M, ChartType>,
  ) {
    super();
  };
  
  draw = () => {
    const { getHtmlId } = this.prevOutput.baseState;

    this.traces = this.linesLayer.linesDC.map((lDC, index) => {
      const linePathSC = this.toPath(this.linesLayer.currLinesSC[index]);
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

  zoom = async () => {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.linesLayer.linesDC.length; i++) {
      const promise = this.traces[i]
        .transition()
        .duration(this.prevOutput.configState.zoom.animationDuration)
        // we do a custom animation because it is faster than d3's default
        .attrTween("d", () => this.customTween(i))
        .end();
      promises.push(promise);
    };
    await Promise.all(promises);
  };

  // After zoom animation, LinesLayer re-calculates lines at appropriate resolution.
  // Replace traces using newly re-calculated lines, without the user knowing.
  afterZoom = () => {
    this.traces.forEach((t, index) => {
      t.attr("d", this.toPath(this.linesLayer.currLinesSC[index]))
    });
  };

  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease.
  private customTween = (index: number): ((t: number) => string) => {
    return (t: number) => this.linesLayer.getNewLineSC(index, t);
  };

  // TODO: consider moving this into LinesLayer if it is duplicated in AreaLayer
  private toPath = (lineSC: Point[]) => {
    return customLineGenerator(lineSC, this.prevOutput.baseState.clipPathBounds).join("");
  };
}
