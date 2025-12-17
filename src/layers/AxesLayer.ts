import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { AxisType, D3Selection, LayerArgs, ScaleNumeric, TickConfig, XY, XYLabel } from "@/types";

type AxisElements = ({
  layer: D3Selection<SVGGElement>,
  axis: d3.Axis<d3.NumberValue>,
} | {
  layer: null;
  axis: null;
}) & {
  line: D3Selection<SVGLineElement> | null
}

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public labels: XYLabel, public labelPositions: XY<number>) {
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
          .attr("y", margin.left * this.labelPositions.y)
          .attr("transform", "rotate(-90)")
      } else {
        const usableWidth = width - margin.left - margin.right;
        label.attr("x", usableWidth / 2 + margin.left)
          .attr("y", height - margin.bottom * this.labelPositions.x)
      }
    }

    return layerArgs.scaleConfig.categoricalScales[axis]
      ? this.drawCategoricalAxis(axis, layerArgs)
      : this.drawNumericalAxis(axis, numericalScale, layerArgs, 12);
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
      const promiseX = axisLayerX?.transition()
        .duration(animationDuration)
        .call(axisX)
        .end();

      const promiseY = axisLayerY?.transition()
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

  private drawCategoricalAxis = (axis: AxisType, layerArgs: LayerArgs): AxisElements => {
    const categoricalScale = layerArgs.scaleConfig.categoricalScales[axis]!.main;
    const { margin } = layerArgs.bounds;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = layerArgs;

    const { translation, axisConstructor } = this.axisConfig(axis, layerArgs);

    const bandwidth = categoricalScale.bandwidth();

    const axisMargin = axis === "x" ? margin.bottom : margin.left;
    const categoricalAxis = axisConstructor(categoricalScale).tickSize(0)
      .tickPadding(axisMargin * (1 - this.labelPositions?.[axis]) / 3);
    svgLayer.append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);

    const bandNumericalScales = Object.entries(layerArgs.scaleConfig.categoricalScales[axis]!.bands);
    bandNumericalScales.forEach(([category, bandNumericalScale]) => {
      const bandStart = categoricalScale(category)!;
      const bandDomain = bandNumericalScale.domain();
      if (bandDomain[0] < 0 && bandDomain[1] > 0) {
        // Add a tick and label at [axis]=0 for each band
        this.drawNumericalAxis(axis, bandNumericalScale, layerArgs, 6);
      }
      if (categoricalScale.paddingInner()) {
        this.drawLinePerpendicularToAxis(axis, bandStart, layerArgs);
      }
      this.drawLinePerpendicularToAxis(axis, bandStart + bandwidth, layerArgs);
    });

    return { layer: null, axis: null, line: null }; // No need to return axis elements as this axis won't be zoomed
  };

  private drawNumericalAxis = (
    axis: AxisType,
    scale: ScaleNumeric,
    layerArgs: LayerArgs,
    defaultTickPadding: number,
  ): AxisElements => {
    const { getHtmlId } = layerArgs;
    const { count: tickCount, specifier: tickSpecifier, padding: tickPadding, size: tickSize } = layerArgs.globals.tickConfig[axis];
    const { translation, axisConstructor } = this.axisConfig(axis, layerArgs);
    let axisLine: D3Selection<SVGLineElement> | null = null;

    const numericalAxis = axisConstructor(scale)
      .ticks(tickCount, tickSpecifier)
      .tickSize(tickSize ?? 0)
      .tickPadding(tickPadding ?? defaultTickPadding);
    const axisLayer = layerArgs.coreLayers[LayerType.Svg].append("g")
      .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
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
    const otherAxis = axis === "x" ? "y" : "x";

    return baseLayer.append("g").append("line")
      .attr(`${axis}1`, positionSC)
      .attr(`${axis}2`, positionSC)
      .attr(`${otherAxis}1`, axis === "x" ? margin.top : margin.left)
      .attr(`${otherAxis}2`, axis === "x" ? height - margin.bottom : width - margin.right)
      .style("stroke", color).style("stroke-width", 0.5);
  }

  private axisConfig = (axis: AxisType, layerArgs: LayerArgs) => {
    const { height, margin } = layerArgs.bounds;
    const otherAxis = axis === "x" ? "y" : "x";
    const svgStartToAxis = axis === "x" ? height - margin.bottom : margin.left;
    // The amount to translate the axis layer by from the starting edge of the svg.
    const translation = {
      [axis]: 0,
      [otherAxis]: svgStartToAxis
    }
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    return { translation, axisConstructor };
  }
}
