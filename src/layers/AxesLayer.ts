import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { D3Selection, LayerArgs, XYLabel } from "@/types";

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public labels: XYLabel) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { getHtmlId } = layerArgs;
    const { animationDuration, ticks } = layerArgs.globals;
    const { logScale } = layerArgs.chartOptions;

    const axisX = d3.axisBottom(scaleX).ticks(ticks.x).tickSize(0).tickPadding(12);
    const axisLayerX = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-x`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(axisX);
    axisLayerX.select(".domain")
      .style("stroke-opacity", 0);
    let axisLineX: D3Selection<SVGLineElement> | null = null;
    if (!logScale.x) {
      axisLineX = baseLayer.append("g").append("line")
        .attr("x1", scaleX(0))
        .attr("x2", scaleX(0))
        .attr("y1", height - margin.bottom)
        .attr("y2", margin.top)
        .style("stroke", "black")
        .style("stroke-width", 0.5);
    }

    // SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
    const axisY = d3.axisLeft(layerArgs.scaleConfig.scaleYCategorical).ticks(ticks.y, ".2~s").tickSize(0).tickPadding(12);
    const axisLayerY = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-y`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${margin.left},0)`)
      .call(axisY);
    axisLayerY.select(".domain")
      .style("stroke-opacity", 0);
    let axisLineY: D3Selection<SVGLineElement> | null = null;
    if (!logScale.y) {
      axisLineY = baseLayer.append("g").append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", scaleY(0))
        .attr("y2", scaleY(0))
        .style("stroke", "black")
        .style("stroke-width", 0.5);
    }

    if (this.labels.y) {
      layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-labely`)
        .style("font-size", "1.2rem")
        .attr("text-anchor", "middle")
        .attr("x", - (height - margin.top - margin.bottom) / 2 - margin.top)
        .attr("y", margin.left / 3)
        .attr("transform", "rotate(-90)")
        .text(this.labels.y)
    }

    if (this.labels.x) {
      layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-labelx`)
        .style("font-size", "1.2rem")
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

      const promiseAxisLineX = axisLineX?.transition()
        .duration(animationDuration)
        .attr("x1", scaleX(0))
        .attr("x2", scaleX(0))
        .end();

      const promiseAxisLineY = axisLineY?.transition()
        .duration(animationDuration)
        .attr("y1", scaleY(0))
        .attr("y2", scaleY(0))
        .end();

      await Promise.all([promiseX, promiseY, promiseAxisLineX, promiseAxisLineY]);
    };
  };
}
