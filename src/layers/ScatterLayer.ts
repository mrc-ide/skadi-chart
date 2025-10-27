import { LayerArgs, ScatterPoints } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { numScales } from "@/helpers";

export class ScatterLayer<Metadata> extends OptionalLayer {
  type = LayerType.Scatter;

  constructor(public points: ScatterPoints<Metadata>) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { animationDuration } = layerArgs.globals;
    const { getHtmlId } = layerArgs;

    const scatter = baseLayer.append("g");
    const scatterPoints = this.points.map((p, index) => {
      const scales = numScales(p.bands, layerArgs);

      return scatter.append("circle")
        .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
        .attr("pointer-events", "none")
        .attr("cx", scales.x(p.x))
        .attr("cy", scales.y(p.y))
        .attr("r", p.style?.radius || "0.2%")
        .attr("fill", p.style?.color || "black")
        .style("opacity", p.style?.opacity || 1)
    });

    this.zoom = async () => {
      const promises: Promise<void>[] = [];
      scatterPoints.forEach((sp, index) => {
        const scales = numScales(this.points[index].bands, layerArgs);

        const promise = sp.transition()
          .duration(animationDuration)
          .attr("cx", scales.x(this.points[index].x))
          .attr("cy", scales.y(this.points[index].y))
          .end();
        promises.push(promise);
      });
      await Promise.all(promises);
    };
  };
}
