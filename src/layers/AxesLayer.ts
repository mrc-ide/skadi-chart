import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { LayerArgs, XYLabel } from "@/types";

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public labels: XYLabel) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = layerArgs;
    const { animationDuration, ticks } = layerArgs.globals;

    const axisX = d3.axisBottom(scaleX).ticks(ticks.x).tickSize(0).tickPadding(8);
    const axisLayerX = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-x`)
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(axisX);

    const axisY = d3.axisLeft(scaleY).ticks(ticks.y).tickSize(0).tickPadding(8)
      // SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
      .tickFormat(d3.format(".2~s"));
    const axisLayerY = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-y`)
      .attr("transform", `translate(${margin.left},0)`)
      .call(axisY);

    if (this.labels.y) {
      layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-labely`)
        .attr("text-anchor", "middle")
        .attr("x", - (height - margin.top - margin.bottom) / 2 - margin.top)
        .attr("y", margin.left / 4)
        .attr("transform", "rotate(-90)")
        .text(this.labels.y)
    }

    if (this.labels.x) {
      layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-labelx`)
        .attr("text-anchor", "middle")
        .attr("x", (width - margin.left - margin.right) / 2 + margin.left)
        .attr("y", layerArgs.bounds.height - margin.bottom / 3)
        .text(this.labels.x)
    }

    // The zoom layer (if added) will update the scaleX and scaleY
    // so axisY and axisX, which are constructed from these will
    // also update. This function just specifies a smooth transition
    // between the old and new values of the scales
    this.zoom = async () => {
      const promiseX = axisLayerX.transition()
        .duration(animationDuration)
        .call(axisX)
        .end();

      const promiseY = axisLayerY.transition()
        .duration(animationDuration)
        .call(axisY)
        .end();

      await Promise.all([promiseX, promiseY]);
    };
  };
}
