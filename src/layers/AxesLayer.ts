import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { AxisType, D3Selection, LayerArgs, ScaleNumeric, XY } from "@/types";
import { drawLine, numScalesForAxis } from "@/helpers";

declare const MathJax: any;

export type AxisConfig = {
  label?: string,
  labelPosition: number,
  includeZeroLine: boolean,
}

type AxisElements = ({
  layer: D3Selection<SVGGElement>,
  axis: d3.Axis<d3.NumberValue>,
} | {
  layer: null;
  axis: null;
}) & {
  lineParts: D3Selection<SVGLineElement>[]
}

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  constructor(public options: XY<AxisConfig>) {
    super();
  };

  private drawAxis = (axis: AxisType, layerArgs: LayerArgs): AxisElements => {
    const { width, height, margin } = layerArgs.bounds;
    const { getHtmlId } = layerArgs;
    const numericalScale = layerArgs.scaleConfig.numericalScales[axis];

    if (this.options[axis].label) {
      const label = layerArgs.coreLayers[LayerType.Svg].append("text")
        .attr("id", `label${axis}-${getHtmlId(LayerType.Axes)}`)
        .style("font-size", "1.2rem")
        .attr("text-anchor", "middle")
        .text(this.options[axis].label)
      if (axis === "y") {
        const usableHeight = height - margin.top - margin.bottom;
        label.attr("x", - usableHeight / 2 - margin.top)
          .attr("y", margin.left * this.options[axis].labelPosition)
          .attr("transform", "rotate(-90)")
      } else {
        const usableWidth = width - margin.left - margin.right;
        label.attr("x", usableWidth / 2 + margin.left)
          .attr("y", height - margin.bottom * this.options[axis].labelPosition)
      }
    }

    return layerArgs.scaleConfig.categoricalScales[axis]
      ? this.drawCategoricalAxis(axis, layerArgs)
      : this.drawNumericalAxis(axis, numericalScale, layerArgs, 12);
  };


  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.numericalScales;
    const { animationDuration } = layerArgs.globals;

    const { layer: axisLayerX, axis: axisX, lineParts: axisLinesX } = this.drawAxis("x", layerArgs);
    const { layer: axisLayerY, axis: axisY, lineParts: axisLinesY } = this.drawAxis("y", layerArgs);

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

      const transitionAxisLineX = (
        axisLineX: D3Selection<SVGLineElement>
      ): Promise<void> => axisLineX.transition()
        .duration(animationDuration)
        .attr("x1", scaleX(0))
        .attr("x2", scaleX(0))
        .end();

      const transitionAxisLineY = (
        axisLineY: D3Selection<SVGLineElement>
      ): Promise<void> => axisLineY.transition()
        .duration(animationDuration)
        .attr("y1", scaleY(0))
        .attr("y2", scaleY(0))
        .end();

      await Promise.all([
        promiseX,
        promiseY,
        ...axisLinesX.map(transitionAxisLineX),
        ...axisLinesY.map(transitionAxisLineY),
      ]);
    };
  };

  private drawCategoricalAxis = (axis: AxisType, layerArgs: LayerArgs): AxisElements => {
    const categoricalScale = layerArgs.scaleConfig.categoricalScales[axis]!.main;
    const { margin } = layerArgs.bounds;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { getHtmlId } = layerArgs;
    const { padding: tickPadding, size: tickSize, formatter: tickFormatter } = layerArgs.globals.tickConfig.categorical[axis];

    const { translation, axisConstructor } = this.axisConfig(axis, layerArgs);

    const bandwidth = categoricalScale.bandwidth();

    const axisMargin = axis === "x" ? margin.bottom : margin.left;
    const defaultTickPadding = axisMargin * (1 - this.options[axis].labelPosition) / 3;
    const categoricalAxis = axisConstructor(categoricalScale)
      .tickSize(tickSize ?? 0)
      .tickPadding(tickPadding ?? defaultTickPadding);
    if (tickFormatter) {
      categoricalAxis.tickFormat(tickFormatter);
    }

    svgLayer.append("g")
      .attr("id", `${axis}-${getHtmlId(LayerType.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);

    const bandNumericalScales = Object.entries(layerArgs.scaleConfig.categoricalScales[axis]!.bands);
    bandNumericalScales.forEach(([category, bandNumericalScale]) => {
      const bandStart = categoricalScale(category)!;
      this.drawNumericalAxis(axis, bandNumericalScale, layerArgs, 6);
      if (categoricalScale.paddingInner()) {
        this.drawLinePerpendicularToAxis(axis, bandStart, layerArgs);
      }
      this.drawLinePerpendicularToAxis(axis, bandStart + bandwidth, layerArgs);
    });

    return { layer: null, axis: null, lineParts: [] }; // No need to return axis elements as this axis won't be zoomed
  };

  private drawNumericalAxis = (
    axis: AxisType,
    scale: ScaleNumeric,
    layerArgs: LayerArgs,
    defaultTickPadding: number,
  ): AxisElements => {
    const { getHtmlId } = layerArgs;
    const {
      count,
      specifier: tickSpecifier,
      padding: tickPadding,
      size: tickSize,
      formatter: tickFormatter,
      enableMathJax
    } = layerArgs.globals.tickConfig.numerical[axis];
    const { translation, axisConstructor } = this.axisConfig(axis, layerArgs);

    const tickCount = count ?? 0;
    const numericalAxis = axisConstructor(scale)
      .ticks(tickCount, tickSpecifier)
      .tickSize(tickSize ?? 0)
      .tickPadding(tickPadding ?? defaultTickPadding);
    if (tickFormatter) {
      if (!enableMathJax) {
        numericalAxis.tickFormat((val: d3.NumberValue, i) => tickFormatter(val as number, i));
      } else {
        numericalAxis.tickFormat(() => "");
      }
    }
    const axisLayer = layerArgs.coreLayers[LayerType.Svg].append("g")
      .attr("id", `${axis}-${getHtmlId(LayerType.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(numericalAxis);
    axisLayer.select(".domain").style("stroke-opacity", 0);

    if (tickFormatter && enableMathJax) {
        console.warn(
          "enableMathJax is currently not compatible with zoom layer" +
          " and is only available for the x axis"
        );
        axisLayer
          .selectAll("g")
          .data((numericalAxis.scale() as ScaleNumeric).ticks(tickCount))
          .append("foreignObject")
          .attr("width", 50) 
          .attr("height", 50)
          .attr("x", 0)
          .attr("y", tickPadding ?? defaultTickPadding)
          .append("xhtml:span")
          .attr("class", "tick-mathjax")
          .text((d, i) => tickFormatter(d, i));
        MathJax.typesetPromise().then(() => {
          const spanNodes = layerArgs.coreLayers[LayerType.Svg]
            .selectAll("span.tick-mathjax")
            .nodes() as HTMLSpanElement[];
          spanNodes.forEach(sn => {
            const { width } = sn.getBoundingClientRect();
            const foreignObject = sn.parentElement! as unknown as SVGForeignObjectElement;
            foreignObject.x.baseVal.value = - width / 2;
          });
        });
    }

    let axisLines: D3Selection<SVGLineElement>[] = [];
    // Draw a line at [axis]=0 if this is within scale range
    const [minDC, maxDC] = [...scale.domain()].sort();
    if (this.options[axis].includeZeroLine && minDC <= 0 && maxDC >= 0) {
      axisLines = this.drawLinePerpendicularToAxis(axis, scale(0), layerArgs, "darkgrey");
    }

    return { layer: axisLayer, axis: numericalAxis, lineParts: axisLines };
  }

  // Draws a line perpendicular to the specified axis at the given position in scale coordinates.
  // If the other axis is not a categorical axis, we simply draw one line and return.
  // If the other axis is categorical, we draw a line for each category band of the other axis,
  // to prevent lines cutting through inter-band padding (i.e. we draw 'one' interrupted 'line'
  // out of multiple shorter lines with gaps for padding as required by the other axis).
  private drawLinePerpendicularToAxis = (
    axis: AxisType,
    positionSC: number,
    layerArgs: LayerArgs,
    color: string = "black",
  ): D3Selection<SVGLineElement>[] => {
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const otherAxis = axis === "x" ? "y" : "x";
    const otherAxisScales = numScalesForAxis(otherAxis, layerArgs);

    const lineParts = otherAxisScales.map(otherAxisScale => {
      return baseLayer.append("g").append("line")
        .attr(`${axis}1`, positionSC)
        .attr(`${axis}2`, positionSC)
        .attr(`${otherAxis}1`, otherAxisScale.range()[0])
        .attr(`${otherAxis}2`, otherAxisScale.range()[1])
        .style("stroke", color).style("stroke-width", 0.5);
    })
    return lineParts.filter(line => line !== undefined);
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
