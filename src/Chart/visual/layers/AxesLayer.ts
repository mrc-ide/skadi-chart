import * as d3 from "@/d3";
import { Layer } from "./Layer";
import { Point, ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput, TickConfigBase, TickFormatter } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ScaleCategorical } from "@/Chart/config/scales";
import { getInner } from "@/Chart/base/utils";
import { doXY } from "@/helpers";

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
  };

  private drawCategorical = (
    axis: XorY,
    { scale, categories }: ScaleCategorical,
    tickConfig: { categorical: TickConfigBase<string>, numerical: TickConfigBase<number> },
  ) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const { formatter } = tickConfig.categorical;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    
    const categoricalAxis = axisConstructor(scale)
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

    Object.entries(categories).forEach(([_, categoryScale]) => {
      this.drawNumerical(axis, categoryScale, tickConfig.numerical, false);
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
