import { LayerArgs, ScatterPoints } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

export class ScatterLayer<Metadata> extends OptionalLayer {
  type = LayerType.Scatter;

  constructor(public points: ScatterPoints<Metadata>, public categoricalPoints: ScatterPoints<Metadata> = []) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { animationDuration } = layerArgs.globals;
    const { getHtmlId } = layerArgs;

    const scatter = baseLayer.append("g");
    const scatterPoints = this.points.map((p, index) => {
      return scatter.append("circle")
        .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
        .attr("pointer-events", "none")
        .attr("cx", scaleX(p.x))
        .attr("cy", scaleY(p.y))
        .attr("r", p.style?.radius || "0.2%")
        .attr("fill", p.style?.color || "black")
        .style("opacity", p.style?.opacity || 1)
    });

    const categoricalDomain = layerArgs.scaleConfig.scaleYCategorical.domain();
    const categoryThickness = layerArgs.scaleConfig.scaleYCategorical.step();
    const squashFactor = categoricalDomain.length;

    this.categoricalPoints.map((p, index) => {
      const category = p.metadata?.category;
      const categoryIndex = categoricalDomain.findIndex(c => c === category);
      // Centering 0 within the ridge. TODO: Alternative (for lines with no negative values) would put 0 at bottom of ridge.
      let translation = (((categoricalDomain.length - 1) / 2) - categoryIndex) * categoryThickness;

      scatter.append("circle")
        .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
        .attr("pointer-events", "none")
        .attr("cx", scaleX(p.x))
        .attr("cy", scaleY(p.y / squashFactor))
        .attr("r", p.style?.radius || "0.2%")
        .attr("fill", p.style?.color || "black")
        .style("opacity", p.style?.opacity || 1)
        .attr("transform", `translate(0, ${translation})`)
    })

    this.zoom = async () => {
      const promises: Promise<void>[] = [];
      scatterPoints.forEach((sp, index) => {
        const promise = sp.transition()
          .duration(animationDuration)
          .attr("cx", scaleX(this.points[index].x))
          .attr("cy", scaleY(this.points[index].y))
          .end();
        promises.push(promise);
      });
      await Promise.all(promises);
    };
  };
}
