import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { AxisType, D3Selection, LayerArgs, ScaleNumeric, TickConfig, XYLabel } from "@/types";

type AxisElements = {
  layer: D3Selection<SVGGElement> | null;
  axis: d3.Axis<d3.NumberValue> | null;
  line: D3Selection<SVGLineElement> | null;
}

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public labels: XYLabel) {
    super();
  };

  private drawAxis = (axis: AxisType, layerArgs: LayerArgs): AxisElements => {
    const { width, height, margin } = layerArgs.bounds;
    const { getHtmlId } = layerArgs;
    const numericalScale = layerArgs.scaleConfig.linearScales[axis];

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

    return layerArgs.scaleConfig.categoricalScales[axis]
      ? this.drawCategoricalAxis(axis, layerArgs)
      : this.drawNumericalAxis(axis, numericalScale, { ...layerArgs.globals.tickConfig[axis], padding: 12 }, layerArgs);
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
      const promises = [];
      if (axisX && axisLayerX) {
        promises.push(axisLayerX.transition()
          .duration(animationDuration)
          .call(axisX)
          .end());
      }

      if (axisY && axisLayerY) {
        promises.push(axisLayerY.transition()
          .duration(animationDuration)
          .call(axisY)
          .end());
      }

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

      await Promise.all([...promises, promiseAxisLineX, promiseAxisLineY]);
    };
  };

  // The amount to translate the axis layer by from the edge of the svg.
  private translation = (axis: AxisType, layerArgs: LayerArgs) => {
    const svgStartToAxis = this.svgStartToAxis(axis, layerArgs);
    return {
      [axis]: 0,
      [this.otherAxis(axis)]: svgStartToAxis
    };
  }

  private svgStartToAxis = (axis: AxisType, layerArgs: LayerArgs) => {
    const { height, margin } = layerArgs.bounds;
    return axis === "x" ? height - margin.bottom : margin.left;
  }

  private drawCategoricalAxis = (axis: AxisType, layerArgs: LayerArgs): AxisElements => {
    const categoricalScale = layerArgs.scaleConfig.categoricalScales[axis]!.main;
    const { margin } = layerArgs.bounds;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = layerArgs;
    const { count: tickCount } = layerArgs.globals.tickConfig[axis];

    const translate = this.translation(axis, layerArgs);
    const bandwidth = categoricalScale.bandwidth();
    const axisCon = this.axisConstructor(axis);

    const distanceFromSvgEdgeToAxis = axis === "x" ? margin.bottom : margin.left;
    const showZeroLine = !layerArgs.chartOptions.logScale[axis];
    const categoricalAxis = axisCon(categoricalScale).ticks(tickCount).tickSize(0)
      .tickPadding(distanceFromSvgEdgeToAxis * (showZeroLine ? 0.3 : 0.2));
    svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translate.x},${translate.y})`)
      .call(categoricalAxis);

    const bandNumericalScales = Object.entries(layerArgs.scaleConfig.categoricalScales[axis]!.bands);
    bandNumericalScales.forEach(([category, bandNumericalScale]) => {
      if (showZeroLine && layerArgs.scaleConfig.categoricalScales.y) {
        // Add a tick and label at y=0 for each band, if the y-axis is categorical
        this.drawNumericalAxis("y", bandNumericalScale, { count: 1, padding: 6 }, layerArgs);
      }
      // Each band gets a line at its ending edge
      this.drawLinePerpendicularToAxis(axis, categoricalScale(category)! + bandwidth, layerArgs);
    });

    return { layer: null, axis: null, line: null }; // No need to return axis elements as this axis won't be zoomed
  };

  private drawNumericalAxis = (
    axis: AxisType,
    scale: ScaleNumeric,
    tickConfig: TickConfig & { padding: number },
    layerArgs: LayerArgs
  ): AxisElements => {
    const { getHtmlId } = layerArgs;
    const { count: tickCount, specifier: tickSpecifier, padding: tickPadding } = tickConfig;
    const axisCon = this.axisConstructor(axis);
    const translate = this.translation(axis, layerArgs);
    let axisLine: D3Selection<SVGLineElement> | null = null;

    const numericalAxis = axisCon(scale).ticks(tickCount, tickSpecifier).tickSize(0).tickPadding(tickPadding);
    const axisLayer = layerArgs.coreLayers[LayerType.Svg].append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translate.x},${translate.y})`)
      .call(numericalAxis);
    axisLayer.select(".domain").style("stroke-opacity", 0);

    if (!layerArgs.chartOptions.logScale[axis]) {
      // Draw a line at [axis]=0
      axisLine = this.drawLinePerpendicularToAxis(axis, scale(0), layerArgs, "darkgrey");
    }

    return { layer: axisLayer, axis: numericalAxis, line: axisLine };
  }

  private drawLinePerpendicularToAxis = (
    axis: AxisType,
    positionSC: number,
    layerArgs: LayerArgs,
    color: string = "black",
  ) => {
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { height, width, margin } = layerArgs.bounds;

    return baseLayer.append("g").append("line")
      .attr(`${axis}1`, positionSC)
      .attr(`${axis}2`, positionSC)
      .attr(`${this.otherAxis(axis)}1`, axis === "x" ? margin.top : margin.left)
      .attr(`${this.otherAxis(axis)}2`, axis === "x" ? height - margin.bottom : width - margin.right)
      .style("stroke", color).style("stroke-width", 0.5);
  }

  private otherAxis = (axis: AxisType) => axis === "x" ? "y" : "x";

  private axisConstructor = (axis: AxisType) => axis === "x" ? d3.axisBottom : d3.axisLeft;
}
