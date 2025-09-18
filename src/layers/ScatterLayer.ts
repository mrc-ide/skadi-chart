import { BandScatterPoints, LayerArgs, ScatterPoints } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

export class ScatterLayer<Metadata> extends OptionalLayer {
  type = LayerType.Scatter;

  constructor(public points: ScatterPoints<Metadata>, public ridgelinePoints: BandScatterPoints<Metadata> = []) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const { x: ridgelineScaleX, y: ridgelineScaleY } = layerArgs.scaleConfig.ridgelineScales;
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

    Object.entries(layerArgs.scaleConfig.ridgelineScales).forEach(([a, bandScale]) => {
      const ridgelineDomain = bandScale.domain();
      const bandThickness = bandScale.step();
      const squashFactor = ridgelineDomain.length;
      const axis = a as "x" | "y";
      const otherAxis = a === "x" ? "y" : "x";

      this.ridgelinePoints.map((p, index) => {
        const bandIndex = ridgelineDomain.findIndex(c => c === p.bands[axis]);
        const linearScales = layerArgs.scaleConfig.linearScales;

        let translation = axis === "x"
          ? `translate(${bandIndex * bandThickness}, 0)`
          : `translate(0, ${(((ridgelineDomain.length - 1) / 2) - bandIndex) * bandThickness})`;

        scatter.append("circle")
          .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
          .attr("pointer-events", "none")
          .attr(`c${axis}`, linearScales[axis](p[axis] / squashFactor))
          .attr(`c${otherAxis}`, linearScales[otherAxis](p[otherAxis]))
          .attr("r", p.style?.radius || "0.2%")
          .attr("fill", p.style?.color || "black")
          .style("opacity", p.style?.opacity || 1)
          .attr("transform", translation)
      });
    });

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
