import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { D3Selection, LayerArgs, XYLabel } from "@/types";

// todo - make sure we cope with y axes that have a 0 at the bottom of the graph not the middle.

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  // todo - first PR should actually just refactor axeslayer to treat x and y the same. Then the diff for categorical axes will be much clearer.

  constructor(public labels: XYLabel) {
    super();
  };

  private drawAxis = (axis: 'x' | 'y', layerArgs: LayerArgs) => {
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { width, height, margin } = layerArgs.bounds;
    const { getHtmlId } = layerArgs;
    const scale = layerArgs.scaleConfig.linearScales[axis];
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    const { count: tickCount, specifier: tickSpecifier } = layerArgs.globals.tickConfig[axis];
    const svgStartToAxis = axis === "x" ? height - margin.bottom : margin.left;
    const otherAxis = axis === "x" ? "y" : "x";
    const translate = { [axis]: 0, [otherAxis]: svgStartToAxis }

    const numericalAxis = axisConstructor(scale).ticks(tickCount, tickSpecifier).tickSize(0).tickPadding(12);
    const axisLayer = svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translate.x},${translate.y})`)
      .call(numericalAxis);
    axisLayer.select(".domain")
      .style("stroke-opacity", 0);
    let axisLine: D3Selection<SVGLineElement> | null = null;
    if (!layerArgs.chartOptions.logScale[axis]) {
      // A line at [axis]=0
      axisLine = baseLayer.append("g").append("line")
        .attr(`${axis}1`, scale(0))
        .attr(`${axis}2`, scale(0))
        .attr(`${otherAxis}1`, svgStartToAxis)
        .attr(`${otherAxis}2`, axis === "x" ? margin.top : width - margin.right)
        .style("stroke", "black")
        .style("stroke-width", 0.5);
    }

    if (this.labels[axis]) {
      const label = layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-label${axis}`)
        .style("font-size", "1.2rem")
        .attr("text-anchor", "middle")
        .text(this.labels[axis])
      if (axis === "y") {
        const usableHeight = height - margin.top - margin.bottom;
        label.attr("x", - usableHeight / 2 - margin.top)
          .attr("y", margin.left / 3)
          .attr("transform", "rotate(-90)")
      } else {
        const usableWidth = width - margin.left - margin.right;
        label.attr("x", usableWidth / 2 + margin.left)
          .attr("y", height - margin.bottom / 3)
      }
    }

    return { layer: axisLayer, axis: numericalAxis, line: axisLine };
  };

  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const { animationDuration } = layerArgs.globals;

    const { layer: axisLayerX, axis: axisX, line: axisLineX } = this.drawAxis("x", layerArgs);
    const { layer: axisLayerY, axis: axisY, line: axisLineY } = this.drawAxis("y", layerArgs);

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
