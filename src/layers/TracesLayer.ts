import { Lines } from "@/Chart";
import { LayerArgs, LayerType, OptionalLayer } from "./Layer";

export class TracesLayer extends OptionalLayer {
  type = LayerType.Trace;

  constructor(public lines: Lines) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const subLayers = this.lines.map((l, index) => {
      const linePath = layerArgs.scaleConfig.lineGen(l.points);
      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Trace)}-${index}`)
        .attr("pointer-events", "none")
        .attr("vector-effect", "non-scaling-stroke")
        .attr("fill", "none")
        .attr("stroke", l.style.color || "black")
        .attr("opacity", l.style.opacity || 1)
        .attr("stroke-width", l.style.strokeWidth || 1)
        .attr("d", linePath);
    });

    // The zoom layer updates scaleX and scaleY and the lineGen
    // function is constructed from the scales so this function
    // when called will do a smoooth transition between the new
    // lines and the old ones
    this.doZoom = () => {
      this.lines.forEach((l, index) => {
        const linePath = layerArgs.scaleConfig.lineGen(l.points);
        subLayers[index]
          .transition()
          .duration(layerArgs.globals.animationDuration)
          .attr("d", linePath)
      });
    };
  };
}

