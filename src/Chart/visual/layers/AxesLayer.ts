import * as d3 from "@/d3";
import { Layer } from "./Layer";
import { Point, ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ScaleCategorical } from "@/Chart/config/scales";
import { getInner } from "@/Chart/base/utils";
import { doXY } from "@/helpers";
import { TickConfigBase, TickFormatter } from "@/Chart/config/ticks";

const animationDuration = 350;
declare const MathJax: any;

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
      const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
      const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
      this.drawNumerical("x", xScale, xTickConfig.numerical, true);
      this.drawNumerical("y", yScale, yTickConfig.numerical, true);
    } else if (this.prevOutput.chartType === "categoricalX") {
      const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
      const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
      this.drawCategorical("x", xScale, xTickConfig);
      this.drawNumerical("y", yScale, yTickConfig.numerical, true);
      if (xScale.scale.paddingInner() !== 0) {
        yScale.domain().forEach(d => this.drawPerpendicularLine("y", yScale, false, d));
      }
    } else if (this.prevOutput.chartType === "categoricalY") {
      const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
      const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
      this.drawNumerical("x", xScale, xTickConfig.numerical, true);
      this.drawCategorical("y", yScale, yTickConfig);
      if (yScale.scale.paddingInner() !== 0) {
        xScale.domain().forEach(d => this.drawPerpendicularLine("x", xScale, false, d));
      }
    } else {
      const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
      const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
      this.drawCategorical("x", xScale, xTickConfig);
      this.drawCategorical("y", yScale, yTickConfig);
    }

    this.addLabels();
  };

  private drawNumerical = (
    axis: XorY,
    scale: ScaleNumeric,
    tickConfig: TickConfigBase<number>,
    addZoom: boolean,
  ) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const { formatter: tickFormatter } = tickConfig;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;

    const numericalAxis = axisConstructor(scale)
      .ticks(tickConfig.count, tickConfig.specifier)
      .tickSize(tickConfig.size)
      .tickPadding(tickConfig.padding);
    if (tickFormatter) {
      if (tickConfig.enableMathJax) {
        // When MathJax is enabled, blank out the default text labels here.
        // the MathJax-rendered labels are drawn separately below, as foreignObject elements.
        numericalAxis.tickFormat(() => "");
      } else {
        numericalAxis.tickFormat((val: d3.NumberValue, i) => tickFormatter(val as number, i));
      }
      // When d3-axis' .tickFormat is left uncalled, d3-axis falls back to its own built-in default
      // formatter which makes use of the specifier option.
    }

    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(numericalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

    if (tickFormatter && tickConfig.enableMathJax) {
      this.drawMathJaxTicks(scale, tickConfig, tickFormatter, axisGElement);
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

    // Draw origin line
    this.drawPerpendicularLine(axis, scale, addZoom, 0);
  };

  private drawCategorical = (
    axis: XorY,
    scaleCategorical: ScaleCategorical,
    tickConfig: { categorical: TickConfigBase<string>, numerical: TickConfigBase<number> },
  ) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const { formatter } = tickConfig.categorical;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    
    const bandScale = scaleCategorical.scale; // The main, "outer" scale, containing all the bands
    const categoricalAxis = axisConstructor(bandScale)
      .tickSize(tickConfig.categorical.size)
      .tickPadding(tickConfig.categorical.padding);
    if (formatter) {
      categoricalAxis.tickFormat(formatter);
    }
    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-categorical-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

    // Process each band's "inner" scale, which is a numerical scale
    Object.entries(scaleCategorical.categories).forEach(([_, innerNumScale]) => {
      this.drawNumerical(axis, innerNumScale, tickConfig.numerical, false);
      if (bandScale.paddingInner() !== 0) {
        innerNumScale.domain().forEach(d => this.drawPerpendicularLine(axis, innerNumScale, false, d));
      }
    });
  };

  private drawMathJaxTicks = (
    scale: ScaleNumeric,
    tickConfig: TickConfigBase<number>,
    tickFormatter: TickFormatter<number>,
    axisGElement: d3.Selection<SVGGElement, Point, null, undefined>,
  ) => {
    console.warn(
      "enableMathJax is currently not compatible with zoom layer" +
      " and is only available for the x axis"
    );
    axisGElement
      .selectAll("g")
      .data(scale.ticks(tickConfig.count))
      .append("foreignObject")
      .attr("width", 50)
      .attr("height", 50)
      .attr("x", 0)
      .attr("y", tickConfig.padding)
      .append("xhtml:span")
      .attr("class", "tick-mathjax")
      .text((d, i) => tickFormatter(d, i));
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
  };

  // Draw a line perpendicular to the specified axis at the given position in data coordinates.
  // This line will be made up of 1 or more segments, since if the other axis is categorical,
  // inter-segment gaps are required for skipping over the padding of the categorical bands.
  private drawPerpendicularLine = (
    axis: XorY,
    numScale: ScaleNumeric,
    addZoom: boolean,
    positionDC: number,
    strokeWidthPx: number = 1,
    color: string = "black",
  ) => {
    const positionSC = numScale(positionDC);
    const [minSC, maxSC] = numScale.range().sort((a, b) => a - b);
    // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
    if (positionSC < minSC || positionSC > maxSC) return;

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
        .attr(`${axis}1`, positionSC)
        .attr(`${axis}2`, positionSC)
        .attr(`${foreignAxis}1`, scale.range()[0])
        .attr(`${foreignAxis}2`, scale.range()[1])
        .style("stroke", color).style("stroke-width", strokeWidthPx);

      if (addZoom) {
        const zoom = async () => {
          const newPositionSC = numScale(positionDC);
          await lineSegment.transition()
            .duration(animationDuration)
            .attr(`${axis}1`, newPositionSC)
            .attr(`${axis}2`, newPositionSC)
            .style("stroke-width", strokeWidthPx)
            .end();
        };
        this.zoomCallbacks.push(zoom);
      }
    });
  };

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
  };
}
