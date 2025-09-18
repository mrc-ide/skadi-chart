import * as d3 from "@/d3";
import { BandScatterPoints, D3Selection, LayerArgs, ScaleConfig, ScatterPoints, XY } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
export class ScatterLayer<Metadata> extends OptionalLayer {
  type = LayerType.Scatter;

  constructor(public points: ScatterPoints<Metadata>, public ridgelinePoints: BandScatterPoints<Metadata> = []) {
    super();
  };

  private getRidgelinePointPositionSC = (
    pointDC: BandScatterPoints<Metadata>[0],
    scaleConfig: ScaleConfig,
  ) => {
    const { x: ridgelineScaleX, y: ridgelineScaleY } = scaleConfig.ridgelineScales;
    const { x: linearScaleX, y: linearScaleY } = scaleConfig.linearScales;
    const squashFactors = {
      x: ridgelineScaleX?.domain().length || 1,
      y: scaleConfig.ridgelineScales.y?.domain().length || 1,
    };

    let [xTranslation, yTranslation] = [0, 0];

    if (ridgelineScaleX) {
      const ridgelineDomain = ridgelineScaleX.domain();
      const bandIndex = ridgelineDomain.findIndex(c => c === pointDC.bands.x);
      xTranslation = bandIndex * ridgelineScaleX.step();
    }

    if (ridgelineScaleY) {
      const ridgelineDomain = ridgelineScaleY.domain();
      const bandIndex = ridgelineDomain.findIndex(c => c === pointDC.bands.y);
      // Centering 0 within the ridge. TODO: Alternative (for lines with no negative values) would put 0 at bottom of ridge.
      yTranslation = (((ridgelineDomain.length - 1) / 2) - bandIndex) * ridgelineScaleY.step();
    }

    return {
      translation: `translate(${xTranslation}, ${yTranslation})`,
      center: {
        x: linearScaleX(pointDC.x / squashFactors.x),
        y: linearScaleY(pointDC.y / squashFactors.y)
      }
    };
  };

  draw = (layerArgs: LayerArgs) => {
    const { x: linearScaleX, y: linearScaleY } = layerArgs.scaleConfig.linearScales;
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { animationDuration } = layerArgs.globals;
    const { getHtmlId } = layerArgs;

    const scatter = baseLayer.append("g");
    const scatterPoints = this.points.map((p, index) => {
      return scatter.append("circle")
        .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
        .attr("pointer-events", "none")
        .attr("cx", linearScaleX(p.x))
        .attr("cy", linearScaleY(p.y))
        .attr("r", p.style?.radius || "0.2%")
        .attr("fill", p.style?.color || "black")
        .style("opacity", p.style?.opacity || 1)
    });

    const ridgelineScatterPoints = this.ridgelinePoints.map((p, index) => {
      const { center, translation } = this.getRidgelinePointPositionSC(p, layerArgs.scaleConfig);

      return scatter.append("circle")
        .attr("id", `${getHtmlId(LayerType.Scatter)}-${index}`)
        .attr("pointer-events", "none")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("transform", translation)
        .attr("r", p.style?.radius || "0.2%")
        .attr("fill", p.style?.color || "black")
        .style("opacity", p.style?.opacity || 1)
    });

    this.zoom = async () => {
      const promises: Promise<void>[] = [];
      scatterPoints.forEach((sp, index) => {
        const promise = sp.transition()
          .duration(animationDuration)
          .attr("cx", linearScaleX(this.points[index].x))
          .attr("cy", linearScaleY(this.points[index].y))
          .end();
        promises.push(promise);
      });
      ridgelineScatterPoints.forEach((sp, index) => {
        const pointDC = this.ridgelinePoints[index];
        const { center, translation } = this.getRidgelinePointPositionSC(pointDC, layerArgs.scaleConfig);

        const promise = sp.transition()
          .duration(animationDuration)
          .attr("cx", center.x)
          .attr("cy", center.y)
          .attr("transform", translation)
          .end();
        promises.push(promise);
      });
      await Promise.all(promises);
    };
  };
}
