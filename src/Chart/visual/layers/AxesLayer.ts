import * as d3 from "@/d3";
import { Layer } from "./Layer";
import { ScaleNumeric, XorY } from "@/types";
import { ConfigOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ScaleCategory } from "@/Chart/config/scales";
import { getInner } from "@/Chart/start/utils";

const animationDuration = 350;

export class AxesLayer<M> extends Layer<M, null> {
  private zoomCallbacks: (() => Promise<void>)[] = [];

  constructor(
    private configOutput: ConfigOutput<M>,
    private coreLayers: CoreLayers,
  ) {
    super();
  };

  zoom = async () => {
    await Promise.all(this.zoomCallbacks.map(f => f()));
  };

  draw = () => {
    if (this.configOutput.chartType === "default") {
      this.drawNumerical("x", this.configOutput.configState.scales.x, true);
      this.drawNumerical("y", this.configOutput.configState.scales.y, true);
    } else if (this.configOutput.chartType === "categoricalX") {
      this.drawCategorical("x", this.configOutput.configState.scales.x);
      this.drawNumerical("y", this.configOutput.configState.scales.y, true);
    } else if (this.configOutput.chartType === "categoricalY") {
      this.drawNumerical("x", this.configOutput.configState.scales.x, true);
      this.drawCategorical("y", this.configOutput.configState.scales.y);
    } else {
      this.drawCategorical("x", this.configOutput.configState.scales.x);
      this.drawCategorical("y", this.configOutput.configState.scales.y);
    }
  };

  private drawNumerical = (axis: XorY, scale: ScaleNumeric, addZoom: boolean) => {
    const { getHtmlId, bounds } = this.configOutput.baseState;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;

    const numericalAxis = axisConstructor(scale);
    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(numericalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

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

  private drawCategorical = (axis: XorY, { scale, categories }: ScaleCategory) => {
    const { getHtmlId, bounds } = this.configOutput.baseState;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    
    const categoricalAxis = axisConstructor(scale);
    this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);

    Object.entries(categories).forEach(([_, categoryScale]) => {
      this.drawNumerical(axis, categoryScale, false);
    });
  };
}
