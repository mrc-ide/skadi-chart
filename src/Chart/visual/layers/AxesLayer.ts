import * as d3 from "@/d3";
import { Layer } from "./Layer";
import { ScaleNumeric, XorY } from "@/types";
import { CategoricalTickConfig, CurrOutput as PrevOutput, NumericalTickConfig } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ScaleCategorical } from "@/Chart/config/scales";
import { getInner } from "@/Chart/base/utils";
import { doXY } from "@/helpers";

declare const MathJax: any;

const animationDuration = 350;

export class AxesLayer<M> extends Layer<M, null> {
  private zoomCallbacks: (() => Promise<void>)[] = [];

  constructor(
    private prevOutput: PrevOutput<M>,
    private coreLayers: CoreLayers,
  ) {
    super();
  };

  zoom = async () => {
    await Promise.all(this.zoomCallbacks.map(f => f()));
  };

  draw = () => {
    if (this.prevOutput.chartType === "default") {
      this.drawNumerical("x", this.prevOutput.configState.scales.x, this.prevOutput.configState.ticks.x.numerical, true);
      this.drawNumerical("y", this.prevOutput.configState.scales.y, this.prevOutput.configState.ticks.y.numerical, true);
    } else if (this.prevOutput.chartType === "categoricalX") {
      this.drawCategorical("x", this.prevOutput.configState.scales.x, this.prevOutput.configState.ticks.x);
      this.drawNumerical("y", this.prevOutput.configState.scales.y, this.prevOutput.configState.ticks.y.numerical, true);
    } else if (this.prevOutput.chartType === "categoricalY") {
      this.drawNumerical("x", this.prevOutput.configState.scales.x, this.prevOutput.configState.ticks.x.numerical, true);
      this.drawCategorical("y", this.prevOutput.configState.scales.y, this.prevOutput.configState.ticks.y);
    } else {
      this.drawCategorical("x", this.prevOutput.configState.scales.x, this.prevOutput.configState.ticks.x);
      this.drawCategorical("y", this.prevOutput.configState.scales.y, this.prevOutput.configState.ticks.y);
    }

    this.addLabels();
  };

  private drawNumerical = (
    axis: XorY,
    scale: ScaleNumeric,
    tickConfig: NumericalTickConfig,
    addZoom: boolean,
  ) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    const { count, specifier, padding, size, formatter, enableMathJax } = tickConfig;

    const numericalAxis = axisConstructor(scale)
      .ticks(count, specifier)
      .tickSize(size)
      .tickPadding(padding);
    if (formatter) {
      if (!enableMathJax) {
        numericalAxis.tickFormat((val: d3.NumberValue, i) => formatter(val as number, i));
      } else {
        numericalAxis.tickFormat(() => "");
      }
    }
    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(numericalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

    if (formatter && enableMathJax) {
      console.warn(
        "enableMathJax is currently not compatible with zoom layer" +
        " and is only available for the x axis"
      );
      axisGElement
        .selectAll("g")
        .data((numericalAxis.scale() as ScaleNumeric).ticks(count))
        .append("foreignObject")
        .attr("width", 50)
        .attr("height", 50)
        .attr("x", 0)
        .attr("y", padding)
        .append("xhtml:span")
        .attr("class", "tick-mathjax")
        .text((d, i) => formatter(d, i));
      MathJax.typesetPromise().then(() => {
        const spanNodes = this.coreLayers[CoreLayer.Svg]
          .selectAll("span.tick-mathjax")
          .nodes() as HTMLSpanElement[];
        spanNodes.forEach(sn => {
          const { width } = sn.getBoundingClientRect();
          const foreignObject = sn.parentElement! as unknown as SVGForeignObjectElement;
          foreignObject.x.baseVal.value = - width / 2;
        });
      });
    }

    if (addZoom) {
      const zoom = async () => {
        await axisGElement.transition()
          .duration(animationDuration)
          .call(numericalAxis)
          .end();
      };
      this.zoomCallbacks.push(zoom);
    }

    this.drawOriginLine(axis, scale, addZoom);
  };

  private drawCategorical = (
    axis: XorY,
    scaleCategorical: ScaleCategorical,
    tickConfig: { numerical: NumericalTickConfig, categorical: CategoricalTickConfig },
  ) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    const { padding, size, formatter } = tickConfig.categorical;

    const bandScale = scaleCategorical.scale; // The main, "outer" scale, containing all the bands
    const categoricalAxis = axisConstructor(bandScale)
      .tickSize(size)
      .tickPadding(padding);
    if (formatter) {
      categoricalAxis.tickFormat((val: string, i) => formatter(val, i));
    }
    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-categorical-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

    const numericalScales = scaleCategorical.categories; // Each band's "inner" scale
    Object.entries(numericalScales).forEach(([_, scale]) => {
      this.drawNumerical(axis, scale, tickConfig.numerical, false);
    });
  };

  // Draw a line at the origin (where axis value is 0) of a numerical scale.
  // This line will be made up of 1 or more segments, since if the other axis is categorical,
  // inter-segment gaps are required for skipping over the padding of the categorical bands.
  private drawOriginLine = (axis: XorY, numScale: ScaleNumeric, addZoom: boolean) => {
    const originSC = numScale(0);
    const [minSC, maxSC] = d3.extent(numScale.range()) as [number, number];
    // If origin is out of range, don't draw the line. Otherwise we might draw a line onto another band.
    if (originSC < minSC || originSC > maxSC) return;

    // The 'main' scale is different from the numerical scale if the numerical scale belongs to a band.
    const mainScaleConfig = this.prevOutput.configState.scales[axis];
    const mainScale = "categories" in mainScaleConfig ? mainScaleConfig.scale : numScale;
    // Due to the clip path, if the origin is at the edge of the chart,
    // a thicker stroke width is required to achieve the same visual thickness.
    const strokeWidthBase = 0.5;
    const strokeWidth = mainScale.range().includes(Math.round(originSC)) ? strokeWidthBase * 2 : strokeWidthBase;

    // Get all the numerical scales for the other axis, termed the 'foreign axis'.
    // Categorical axes contain multiple numerical scales; non-categorical axes contain exactly one.
    const foreignAxis = axis === "x" ? "y" : "x";
    const foreignMainScale = this.prevOutput.configState.scales[foreignAxis];
    const foreignNumScales: ScaleNumeric[] =
      "categories" in foreignMainScale
        ? Object.values(foreignMainScale.categories)
        : [foreignMainScale];

    foreignNumScales.forEach(scale => {
      const lineSegment = this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
        .attr(`${axis}1`, originSC)
        .attr(`${axis}2`, originSC)
        .attr(`${foreignAxis}1`, scale.range()[0])
        .attr(`${foreignAxis}2`, scale.range()[1])
        .style("stroke", "darkgrey").style("stroke-width", strokeWidth);

      if (addZoom) {
        const zoom = async () => {
          const newOriginSC = numScale(0);
          const newStrokeWidth = mainScale.range().includes(Math.round(newOriginSC)) ? strokeWidthBase * 2 : strokeWidthBase;
          await lineSegment.transition()
            .duration(animationDuration)
            .attr(`${axis}1`, newOriginSC)
            .attr(`${axis}2`, newOriginSC)
            .style("stroke-width", newStrokeWidth)
            .end();
        };
        this.zoomCallbacks.push(zoom);
      }
    });
  }

  private addLabels = () => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const inner = getInner(bounds);

    doXY(axis => {
      const { text, padding } = this.prevOutput.configState.axes[axis].label;
      if (!text) return;

      const label = this.coreLayers[CoreLayer.Svg].append("text")
        .attr("id", `${axis}-label-${getHtmlId(VisualLayer.Axes)}`)
          .style("font-size", "1.2rem")
          .attr("text-anchor", "middle")
          .text(text);

      if (axis === "y") {
        const xSC = inner.x.start - padding;
        const ySC = inner.y.center;
        label.attr("x", xSC)
          .attr("y", ySC)
          .attr("transform", "rotate(-90)")
          .attr("transform-origin", `${xSC} ${ySC}`);
      } else {
        label.attr("x", inner.x.center)
          .attr("y", inner.y.end + padding)
      }
    });
  }
}
