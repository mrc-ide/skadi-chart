import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { LayerArgs } from "@/types";

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor() {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = layerArgs;

    let defaultTicksX = 10;
    if (width < 500) defaultTicksX = 6;
    if (width < 300) defaultTicksX = 3;
    const axisX = d3.axisBottom(scaleX).ticks(defaultTicksX);
    const axisLayerX = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-x`)
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(axisX);

    let defaultTicksY = 10;
    if (height < 400) defaultTicksY = 6;
    if (height < 200) defaultTicksY = 3;
    const axisY = d3.axisLeft(scaleY).ticks(defaultTicksY);
    const axisLayerY = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-y`)
      .attr("transform", `translate(${margin.left},0)`)
      .call(axisY);

    // The zoom layer (if added) will update the scaleX and scaleY
    // so axisY and axisX, which are constructed from these will
    // also update. This function just specifies a smooth transition
    // between the old and new values of the scales
    this.zoom = async () => {
      const { animationDuration } = layerArgs.globals;

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
