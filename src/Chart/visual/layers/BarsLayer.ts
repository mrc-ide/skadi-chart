import { D3Selection, ScaleCategorical } from "@/types";
import { CoreLayer, CoreLayers, PredrawLayer, PredrawLayers, VisualLayer } from "../types";
import { Layer } from "./Layer";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { userAxisToAxPos } from "@/Chart/axes/utils";
import { animationDuration } from "@/Chart/interactive/constants";

export class BarsLayer extends Layer {
  private bars: D3Selection<SVGRectElement>[][] = [];

  constructor(
    private prevOutput: PrevOutput,
    private coreLayers: CoreLayers,
    private predrawLayers: PredrawLayers,
  ) {
    super();
  };

  draw = () => {
    const { getHtmlId } = this.prevOutput.baseState;
    const scalesLayer = this.predrawLayers[PredrawLayer.Scales]!;

    this.prevOutput.dataState.bars.forEach((bar, barIdx) => {
      const { axis: baseAx, position: basePos } = userAxisToAxPos(bar.baseAxis);
      const baseScaleFn = scalesLayer.scale(
        baseAx, basePos, ...bar.base.map(() => "categorical" as const)
      );
      const { parentScale: baseScale, coord: baseCoord } = baseScaleFn(bar.base);

      const baseSize = (baseScale.scale as ScaleCategorical).bandwidth();
      const baseStart = baseCoord - baseSize / 2;
      const baseDistance = baseAx === "x" ? "width" : "height"

      const { axis: valueAx, position: valuePos } = userAxisToAxPos(bar.valueAxis);
      const valueScaleFn = scalesLayer.scale(
        valueAx, valuePos, "numerical"
      );
      const valueDistance = valueAx === "x" ? "width" : "height";

      const stackedBars = bar.stack.map((st, stIdx) => {
        let [start, end] = st.range.map(val => valueScaleFn([val]).coord)
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        start = min;
        end = max;

        const size = Math.abs(start - end);

        return this.coreLayers[CoreLayer.BaseLayer].append("rect")
          .attr("id", `${getHtmlId(VisualLayer.Bar)}-${barIdx}-${stIdx}`)
          .attr(baseAx, baseStart)
          .attr(baseDistance, baseSize)
          .attr(valueAx, start)
          .attr(valueDistance, size)
          .style("fill", st.style.color || "black")
          .style("opacity", st.style.opacity || 1);
      });

      this.bars.push(stackedBars);
    });
  };

  zoom = async () => {
    const scalesLayer = this.predrawLayers[PredrawLayer.Scales]!;
    const promises: Promise<void>[] = [];

    this.prevOutput.dataState.bars.forEach((bar, barIdx) => {
      const { axis: valueAx, position: valuePos } = userAxisToAxPos(bar.valueAxis);
      const valueScaleFn = scalesLayer.scale(
        valueAx, valuePos, "numerical"
      );
      const valueDistance = valueAx === "x" ? "width" : "height";

      bar.stack.forEach((st, stIdx) => {
        let [start, end] = st.range.map(val => valueScaleFn([val]).coord)
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        start = min;
        end = max;
        
        const size = Math.abs(start - end);

        const p = this.bars[barIdx][stIdx]
          .transition()
          .duration(animationDuration)
          .attr(valueAx, start)
          .attr(valueDistance, size)
          .end();
        promises.push(p);
      });
    });
  };
}
