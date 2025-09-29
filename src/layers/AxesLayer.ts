import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { AxisType, D3Selection, LayerArgs, XYLabel } from "@/types";

// todo - make sure we cope with y axes that have a 0 at the bottom of the graph not the middle.

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;
  private layerArgs: LayerArgs | null = null;

  constructor(public labels: XYLabel) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    this.layerArgs = layerArgs;
    const { x: scaleX, y: scaleY } = this.layerArgs.scaleConfig.linearScales;
    const { animationDuration } = this.layerArgs.globals;

    const { layer: axisLayerX, axis: axisX, line: axisLineX } = this.drawAxis("x");
    const { layer: axisLayerY, axis: axisY, line: axisLineY } = this.drawAxis("y");

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

  private drawAxis = (axis: AxisType) => {
    if (!this.layerArgs) {
      throw new Error("AxesLayer.drawAxis called before layerArgs set");
    }
    const svgLayer = this.layerArgs.coreLayers[LayerType.Svg];
    const baseLayer = this.layerArgs.coreLayers[LayerType.BaseLayer];
    const { width, height, margin } = this.layerArgs.bounds;
    const { getHtmlId } = this.layerArgs;
    const numericalScale = this.layerArgs.scaleConfig.linearScales[axis];
    const { count: tickCount, specifier: tickSpecifier } = this.layerArgs.globals.tickConfig[axis];
    const translate = this.translation(axis);

    let axisLayer: D3Selection<SVGGElement> | null = null;
    let numericalAxis: d3.Axis<number> | null = null;
    let axisLine: D3Selection<SVGLineElement> | null = null;

    if (this.layerArgs.scaleConfig.categoricalScales[axis]) {
      this.drawCategoricalAxis(axis);
    } else {
      const numericalAxis = this.axisConstructor(axis)(numericalScale).ticks(tickCount, tickSpecifier).tickSize(0).tickPadding(12);
      axisLayer = svgLayer.append("g")
        .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
        .style("font-size", "0.75rem")
        .attr("transform", `translate(${translate.x},${translate.y})`)
        .call(numericalAxis);
      axisLayer.select(".domain")
        .style("stroke-opacity", 0);
      if (!this.layerArgs.chartOptions.logScale[axis]) {
        const otherAxis = this.otherAxis(axis);
        // A line at [axis]=0
        axisLine = baseLayer.append("g").append("line")
          .attr(`${axis}1`, numericalScale(0))
          .attr(`${axis}2`, numericalScale(0))
          .attr(`${otherAxis}1`, this.svgStartToAxis(axis))
          .attr(`${otherAxis}2`, axis === "x" ? margin.top : width - margin.right)
          .style("stroke", "black")
          .style("stroke-width", 0.5);
      }
    }

    if (this.labels[axis]) {
      const label = this.layerArgs.coreLayers[LayerType.Svg].append("text")
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

  private translation = (axis: AxisType) => {
    const svgStartToAxis = this.svgStartToAxis(axis);
    return {
      [axis]: 0,
      [this.otherAxis(axis)]: svgStartToAxis
    };
  }

  private svgStartToAxis = (axis: AxisType) => {
    const { height, margin } = this.layerArgs!.bounds;
    return axis === "x" ? height - margin.bottom : margin.left;
  }

  private drawCategoricalAxis = (axis: AxisType) => {
    if (!this.layerArgs) {
      throw new Error("AxesLayer.drawAxis called before layerArgs set");
    }
    const categoricalScale = this.layerArgs.scaleConfig.categoricalScales[axis]!.main;
    const { margin } = this.layerArgs.bounds;
    const svgLayer = this.layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = this.layerArgs;
    const { count: tickCount } = this.layerArgs.globals.tickConfig[axis];

    const translate = this.translation(axis);
    const bandwidth = categoricalScale.bandwidth();
    const axisCon = this.axisConstructor(axis);

    const distanceFromSvgEdgeToAxis = axis === "x" ? margin.bottom : margin.left;
    const showZeroLine = !this.layerArgs.chartOptions.logScale[axis];
    const ridgelineAxis = axisCon(categoricalScale).ticks(tickCount).tickSize(0)
      .tickPadding(distanceFromSvgEdgeToAxis * (showZeroLine ? 0.3 : 0.2));
    svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translate.x},${translate.y})`)
      .call(ridgelineAxis);

    const bandNumericalScales = Object.entries(this.layerArgs!.scaleConfig.categoricalScales[axis]!.bands);
    // Draw a line at [axis]=0 for each band, and at the band's edge.
    bandNumericalScales.forEach(([category, bandNumericalScale]) => {
      if (showZeroLine) {
        // Draw a line at [axis]=0 for each band
        this.drawLinePerpendicularToAxis(axis, bandNumericalScale(0), "darkgrey"); // darkgrey distinguishes from inter-band lines

        // Add a tick and label at y=0 for each band, if the y-axis is categorical
        if (this.layerArgs!.scaleConfig.categoricalScales.y) {
          const bandNumericalAxis = axisCon(bandNumericalScale).ticks(1).tickSize(0).tickPadding(6);
          svgLayer.append("g")
            .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
            .style("font-size", "0.75rem")
            .attr("transform", `translate(${translate.x},${translate.y})`)
            .call(bandNumericalAxis);
        }
      }
      // Each band gets a line at its ending edge
      this.drawLinePerpendicularToAxis(axis, categoricalScale(category!)! + bandwidth);
    });
  };

  private drawLinePerpendicularToAxis = (axis: AxisType, positionSC: number, color: string = "black") => {
    const baseLayer = this.layerArgs!.coreLayers[LayerType.BaseLayer];
    const { height, width, margin } = this.layerArgs!.bounds;

    baseLayer.append("g").append("line")
      .attr(`${axis}1`, positionSC)
      .attr(`${axis}2`, positionSC)
      .attr(`${this.otherAxis(axis)}1`, axis === "x" ? margin.top : margin.left)
      .attr(`${this.otherAxis(axis)}2`, axis === "x" ? height - margin.bottom : width - margin.right)
      .style("stroke", color).style("stroke-width", 0.5);
  }

  private otherAxis = (axis: AxisType) => axis === "x" ? "y" : "x";

  private axisConstructor = (axis: AxisType) => axis === "x" ? d3.axisBottom : d3.axisLeft;
}
