import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { D3Selection, LayerArgs, XY, XYLabel } from "@/types";

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public labels: XYLabel) {
    super();
  };

  private drawAxis = (
    axis: 'x' | 'y',
    baseLayer: D3Selection<SVGGElement>,
    svgLayer: D3Selection<SVGSVGElement>,
    layerArgs: LayerArgs,
  ) => {
    const { width, height, margin } = layerArgs.bounds;
    const linearScale = layerArgs.scaleConfig.linearScales[axis];
    const logScale = layerArgs.chartOptions.logScale[axis];
    const ridgelineScale = layerArgs.scaleConfig.ridgelineScales[axis];
    const ticks = layerArgs.globals.ticks[axis];
    const { getHtmlId } = layerArgs;

    const otherAxis = axis === "x" ? "y" : "x";
    const graphStartingEdgesSC = { x: margin.left, y: margin.top };
    const graphEndingEdgeSC = { x: width - margin.right, y: height - margin.bottom };

    let numericalAxis: d3.Axis<d3.NumberValue>;
    let axisLayers: D3Selection<SVGGElement>[] = [];
    let axisLine: D3Selection<SVGLineElement> | null = null;
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;

    const transform = axis === "x" ? `translate(0,${graphEndingEdgeSC.y})` : `translate(${graphStartingEdgesSC.x},0)`;
    const showNumericalAxis = !ridgelineScale || ridgelineScale.domain().length < 3;
    // TODO: Show a (squashed) numerical axis alongside categorical axes, if there are only 2 categories.
    if (ridgelineScale) {
      const spaciousTickPadding = axis === "x" ? 24 : 64;
      const ridgelineAxis = axisConstructor(ridgelineScale)
        .ticks(ticks)
        .tickSize(0)
        .tickPadding(showNumericalAxis ? spaciousTickPadding : 12);
      axisLayers.push(svgLayer.append("g")
        .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
        .style("font-size", "0.75rem")
        .attr("transform", transform)
        .call(ridgelineAxis));

      const squashFactor = ridgelineScale.domain().length;
      // Draw a line at [axis]=0 for each band.
      ridgelineScale.domain().forEach(cat => {
        const bandStartSC = ridgelineScale(cat)!;
        const lineCoordSC = bandStartSC + ((linearScale(0) - graphStartingEdgesSC[axis]) / squashFactor);
        baseLayer.append("g").append("line")
          .attr(`${axis}1`, lineCoordSC)
          .attr(`${axis}2`, lineCoordSC)
          .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
          .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
          .style("stroke", "black").style("stroke-width", 0.5);
      });
    } else if (!logScale) {
      // A horizontal line at [axis]=0
      axisLine = baseLayer.append("g").append("line")
        .attr(`${axis}1`, linearScale(0))
        .attr(`${axis}2`, linearScale(0))
        .attr(`${otherAxis}1`, graphEndingEdgeSC[otherAxis])
        .attr(`${otherAxis}2`, graphStartingEdgesSC[otherAxis])
        .style("stroke", "black")
        .style("stroke-width", 0.5);
    }

    if (showNumericalAxis) {
      const tickSpecifier = axis === "x" ? undefined : (".2~s");
      numericalAxis = axisConstructor(linearScale).ticks(ticks, tickSpecifier).tickSize(0).tickPadding(12);

      axisLayers.push(svgLayer.append("g")
        .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
        .style("font-size", "0.75rem")
        .attr("transform", transform)
        .call(numericalAxis));
    }

    axisLayers.forEach(layer => layer.select(".domain").style("stroke-opacity", 0));
    let labelEls: Partial<XY<D3Selection<SVGTextElement>>> = { [axis]: null };

    if (this.labels[axis]) {
      const distanceFromSvgEdgeToAxisSC = { x: margin.bottom, y: margin.left };
      const svgClosestEdgeSC = axis === "x" ? layerArgs.bounds.height : 0;
      // A factor to undo the difference in direction between x and y axes (where y increases downwards in SC but upwards in DC)
      const normalisedDirection = { x: 1, y: -1 };
      const graphExtentSC = graphEndingEdgeSC[axis] - graphStartingEdgesSC[axis];

      labelEls[axis] = svgLayer.append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-label${axis}`)
        .attr("x", normalisedDirection[axis] * (graphExtentSC / 2 + graphStartingEdgesSC[axis]))
        .attr("y", svgClosestEdgeSC + (normalisedDirection[otherAxis] * distanceFromSvgEdgeToAxisSC[axis] / 3))
        .style("font-size", "1.2rem")
        .attr("text-anchor", "middle")
        .text(this.labels[axis])
    }

    labelEls.y?.attr("transform", "rotate(-90)")
  }

  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { animationDuration } = layerArgs.globals;

    this.drawAxis('x', baseLayer, svgLayer, layerArgs);
    this.drawAxis('y', baseLayer, svgLayer, layerArgs);

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
