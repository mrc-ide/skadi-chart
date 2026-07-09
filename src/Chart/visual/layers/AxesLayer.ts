import * as d3 from "@/d3";
import { Layer } from "./Layer";
import { ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, VisualLayer } from "../types";
import { ScaleCategorical } from "@/Chart/config/scales";
import { getInner } from "@/Chart/base/utils";
import { doXY } from "@/helpers";

const animationDuration = 350;
export const originLineStrokeWidth = 1;

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
      this.drawNumerical("x", this.prevOutput.configState.scales.x, true);
      this.drawNumerical("y", this.prevOutput.configState.scales.y, true);
    } else if (this.prevOutput.chartType === "categoricalX") {
      this.drawCategorical("x", this.prevOutput.configState.scales.x);
      this.drawNumerical("y", this.prevOutput.configState.scales.y, true);
    } else if (this.prevOutput.chartType === "categoricalY") {
      this.drawNumerical("x", this.prevOutput.configState.scales.x, true);
      this.drawCategorical("y", this.prevOutput.configState.scales.y);
    } else {
      this.drawCategorical("x", this.prevOutput.configState.scales.x);
      this.drawCategorical("y", this.prevOutput.configState.scales.y);
    }

    this.addLabels();
  };

  private drawNumerical = (axis: XorY, scale: ScaleNumeric, addZoom: boolean) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
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

    // Draw origin line
    this.drawPerpendicularLine(axis, scale, addZoom, 0, originLineStrokeWidth, "darkgrey");
  };

  private drawCategorical = (axis: XorY, scaleCategorical: ScaleCategorical) => {
    const { getHtmlId, bounds } = this.prevOutput.baseState;
    const inner = getInner(bounds);
    const translation = axis === "x"
      ? { x: 0, y: inner.y.end }
      : { x: inner.x.start, y: 0 };
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
    const tickPadding = 30; // This will become a configurable option.
    
    const bandScale = scaleCategorical.scale; // The main, "outer" scale, containing all the bands
    const categoricalAxis = axisConstructor(bandScale).tickPadding(tickPadding);
    const axisGElement = this.coreLayers[CoreLayer.Svg]
      .append("g")
      .attr("id", `${axis}-categorical-${getHtmlId(VisualLayer.Axes)}`)
      .style("font-size", "0.75rem")
      .attr("transform", `translate(${translation.x},${translation.y})`)
      .call(categoricalAxis);
    axisGElement.select(".domain").style("stroke-opacity", 0);

    const numericalScales = scaleCategorical.categories; // Each band's "inner" scale
    Object.entries(numericalScales).forEach(([_, scale]) => {
      this.drawNumerical(axis, scale, false);
      // Draw lines at edges of each band, except if an origin line is already drawn there.
      const [bandStartDC, bandEndDC] = scale.domain().filter(d => d !== 0);
      if (bandStartDC) this.drawPerpendicularLine(axis, scale, false, bandStartDC);
      if (bandEndDC && bandScale.paddingInner() !== 0) this.drawPerpendicularLine(axis, scale, false, bandEndDC);
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
    strokeWidthPx: number = 0.5,
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
