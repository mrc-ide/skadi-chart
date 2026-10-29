import * as d3 from "@/d3";
import { Layer } from "@/Chart/visual/layers/Layer";
import { ScaleCategorical, ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, PredrawLayer, PredrawLayers, VisualLayer } from "../types";
import { getInner } from "@/Chart/html/utils";
import { AxisUtil, doXYStartEnd, makeObjXY, PositionUtil } from "@/helpers";
import { Scales } from "./predraw/ScalesLayer";
import { AxisConfiguration } from "@/Chart/axes/types";
import { animationDuration } from "@/Chart/interactive/constants";

// TODO remove when adding mathjax and zoom layer
// declare const MathJax: any;

export class AxesLayer extends Layer {
  private zoomCallbacks: (() => Promise<void>)[] = [];

  constructor(
    private prevOutput: PrevOutput,
    private predrawLayers: PredrawLayers,
    private coreLayers: CoreLayers,
  ) {
    super();
  };

  zoom = async () => {
    await Promise.all(this.zoomCallbacks.map(f => f()));
  };

  draw = () => {
    const chart = this.prevOutput.chartCfg;
    const scalesLayer = this.predrawLayers[PredrawLayer.Scales];
    const inner = getInner(this.prevOutput.baseState.bounds);
    const { getHtmlId } = this.prevOutput.baseState;
    const translation = {
      x: { start: inner.y.end, end: inner.y.start },
      y: { start: inner.x.start, end: inner.x.end },
    };
    const axisConstructors = {
      x: { start: d3.axisBottom, end: d3.axisTop },
      y: { start: d3.axisLeft, end: d3.axisRight },
    };
    
    const recurseDraw = (
      axis: AxisUtil, position: PositionUtil, path: string,
      scale: Scales, axisCfg: AxisConfiguration[] | undefined,
    ) => {
      if (!axisCfg || axisCfg.length === 0) return;
      const [currAxisCfg, ...restAxisCfg] = axisCfg;

      const axisCons = position.pick(axis.pick(axisConstructors));
      let axisCall: d3.Axis<string> | d3.Axis<d3.NumberValue>
      if (currAxisCfg.type === "categorical") {
        axisCall = axisCons(scale.scale as ScaleCategorical);
      } else {
        axisCall = axisCons(scale.scale as ScaleNumeric)
          .ticks(currAxisCfg.tick.count);
      }

      // TODO enableMathJax
      // TODO default tick counts based on width of element
      axisCall
        .tickSize(currAxisCfg.tick.size)
        .tickPadding(currAxisCfg.tick.translate)

      const tr = position.pick(axis.pick(translation));
      const otherAxisTr = tr + axis.sign() * position.sign() * currAxisCfg.translate;
      const axisTr = makeObjXY(
        a => a === axis.other() ? otherAxisTr : 0
      );

      const axisGElement = this.coreLayers[CoreLayer.Svg]
        .append("g")
        .attr("id", `${path}-${getHtmlId(VisualLayer.Axes)}`)
        .style("visibility", currAxisCfg.show ? "" : "hidden")
        .style("font-size", "0.75rem")
        .attr("transform", `translate(${axisTr["x"]}, ${axisTr["y"]})`)
        .call(axisCall);
      axisGElement.select(".domain").style("stroke-opacity", 0);

      const label = this.coreLayers[CoreLayer.Svg]
        .append("text")
        .attr("text-anchor", "middle")
        .attr(axis.other(), otherAxisTr)
        .attr(axis.curr(), inner[axis.curr()].center)
        .text(currAxisCfg.label.text);

      const lTr = position.sign() * axis.sign() * (40 + currAxisCfg.label.translate);
      if (axis.curr() === "x") {
        label
          .attr("transform", `translate(0, ${lTr})`);
      } else {
        label
          .attr("transform", `translate(${lTr}, 0) rotate(${position.negSign() * 90})`)
          .attr("transform-origin", `${otherAxisTr} ${inner.y.center}`)
      }

      if (currAxisCfg.type === "numerical" && currAxisCfg.drawOrigin) {
        // Draw numerical axis specific elements here
        const s = scale.scale as ScaleNumeric

        // First example of perpendicular use case: the origin line.
        const positionDC = 0;
        const positionSC = s(positionDC);
        const strokeWidthPx = 0.5;

        const [minSC, maxSC] = s.range().sort((a, b) => a - b);

        // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
        if (positionSC < minSC || positionSC > maxSC) return;

        const otherScaleAssumingItsNormal = position.pick(axis.pickOther(scalesLayer!.scales)).scale;
        // Draw the origin line at positionSC
        // IGNORING SEGMENTATION
        // Not correct yet
        this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
          .attr(`${axis.curr()}1`, positionSC)
          .attr(`${axis.curr()}2`, positionSC)
          .attr(`${axis.other()}1`, otherScaleAssumingItsNormal.range()[0])
          .attr(`${axis.other()}2`, otherScaleAssumingItsNormal.range()[1])
          .style("stroke", "black").style("stroke-width", strokeWidthPx);
      }

      if ("categories" in scale && restAxisCfg.length) {
        Object.entries(scale.categories).forEach(([k, s]) => {
          recurseDraw(axis, position, `${path}-${k}`, s, restAxisCfg);
        });
      }
    };

    doXYStartEnd((ax, pos) => {
      const axis = new AxisUtil(ax);
      // todo: some way of skipping over unused positions, but i need to know
      // what is the source of truth in config.
      const position = new PositionUtil(pos);
      const c = position.pick(axis.pick(chart));
      if (!c.length) return;
      const scale = position.pick(axis.pick(scalesLayer!.scales));
      recurseDraw(
        axis, position, `${axis.curr()}-${position.curr()}`, scale, c
      );
    });

    //
    // if (this.prevOutput.chartType === "default") {
    //   const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
    //   const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
    //   this.drawNumerical("x", xScale, xTickConfig.numerical, true);
    //   this.drawNumerical("y", yScale, yTickConfig.numerical, true);
    // } else if (this.prevOutput.chartType === "categoricalX") {
    //   const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
    //   const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
    //   this.drawCategorical("x", xScale, xTickConfig);
    //   this.drawNumerical("y", yScale, yTickConfig.numerical, true);
    //   if (xScale.scale.paddingInner() !== 0) {
    //     yScale.domain().forEach(d => this.drawPerpendicularLine("y", yScale, false, d));
    //   }
    // } else if (this.prevOutput.chartType === "categoricalY") {
    //   const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
    //   const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
    //   this.drawNumerical("x", xScale, xTickConfig.numerical, true);
    //   this.drawCategorical("y", yScale, yTickConfig);
    //   if (yScale.scale.paddingInner() !== 0) {
    //     xScale.domain().forEach(d => this.drawPerpendicularLine("x", xScale, false, d));
    //   }
    // } else {
    //   const { x: xScale, y: yScale } = this.prevOutput.configState.scales;
    //   const { x: xTickConfig, y: yTickConfig } = this.prevOutput.configState.ticks;
    //   this.drawCategorical("x", xScale, xTickConfig);
    //   this.drawCategorical("y", yScale, yTickConfig);
    // }
    //
    // this.addLabels();
  };

  // private drawNumerical = (
  //   axis: XorY,
  //   scale: ScaleNumeric,
  //   tickConfig: TickConfigBase<number>,
  //   addZoom: boolean,
  // ) => {
  //   const { getHtmlId, bounds } = this.prevOutput.baseState;
  //   const { formatter: tickFormatter } = tickConfig;
  //   const inner = getInner(bounds);
  //   const translation = axis === "x"
  //     ? { x: 0, y: inner.y.end }
  //     : { x: inner.x.start, y: 0 };
  //   const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
  //
  //   const numericalAxis = axisConstructor(scale)
  //     .ticks(tickConfig.count, tickConfig.specifier)
  //     .tickSize(tickConfig.size)
  //     .tickPadding(tickConfig.padding);
  //   if (tickFormatter) {
  //     if (tickConfig.enableMathJax) {
  //       // When MathJax is enabled, blank out the default text labels here.
  //       // the MathJax-rendered labels are drawn separately below, as foreignObject elements.
  //       numericalAxis.tickFormat(() => "");
  //     } else {
  //       numericalAxis.tickFormat((val: d3.NumberValue, i) => tickFormatter(val as number, i));
  //     }
  //     // When d3-axis' .tickFormat is left uncalled, d3-axis falls back to its own built-in default
  //     // formatter which makes use of the specifier option.
  //   }
  //
  //   const axisGElement = this.coreLayers[CoreLayer.Svg]
  //     .append("g")
  //     .attr("id", `${axis}-${getHtmlId(VisualLayer.Axes)}`)
  //     .style("font-size", "0.75rem")
  //     .attr("transform", `translate(${translation.x},${translation.y})`)
  //     .call(numericalAxis);
  //   axisGElement.select(".domain").style("stroke-opacity", 0);
  //
  //   if (tickFormatter && tickConfig.enableMathJax) {
  //     this.drawMathJaxTicks(scale, tickConfig, tickFormatter, axisGElement);
  //   }
  //
  //   if (addZoom) {
  //     const zoom = async () => {
  //       await axisGElement.transition()
  //         .duration(animationDuration)
  //         .call(numericalAxis)
  //         .end();
  //     };
  //     this.zoomCallbacks.push(zoom);
  //   }
  //
  //   if (this.prevOutput.configState.axes[axis].drawOrigin) {
  //     // Draw origin line
  //     this.drawPerpendicularLine(axis, scale, addZoom, 0);
  //   }
  // };
  //
  // private drawCategorical = (
  //   axis: XorY,
  //   scaleCategorical: ScaleCategorical,
  //   tickConfig: { categorical: TickConfigBase<string>, numerical: TickConfigBase<number> },
  // ) => {
  //   const { getHtmlId, bounds } = this.prevOutput.baseState;
  //   const { formatter } = tickConfig.categorical;
  //   const inner = getInner(bounds);
  //   const translation = axis === "x"
  //     ? { x: 0, y: inner.y.end }
  //     : { x: inner.x.start, y: 0 };
  //   const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;
  //   
  //   const bandScale = scaleCategorical.scale; // The main, "outer" scale, containing all the bands
  //   const categoricalAxis = axisConstructor(bandScale)
  //     .tickSize(tickConfig.categorical.size)
  //     .tickPadding(tickConfig.categorical.padding);
  //   if (formatter) {
  //     categoricalAxis.tickFormat(formatter);
  //   }
  //   const axisGElement = this.coreLayers[CoreLayer.Svg]
  //     .append("g")
  //     .attr("id", `${axis}-categorical-${getHtmlId(VisualLayer.Axes)}`)
  //     .style("font-size", "0.75rem")
  //     .attr("transform", `translate(${translation.x},${translation.y})`)
  //     .call(categoricalAxis);
  //   axisGElement.select(".domain").style("stroke-opacity", 0);
  //
  //   // Process each band's "inner" scale, which is a numerical scale
  //   Object.entries(scaleCategorical.categories).forEach(([_, innerNumScale]) => {
  //     this.drawNumerical(axis, innerNumScale, tickConfig.numerical, false);
  //     if (bandScale.paddingInner() !== 0) {
  //       innerNumScale.domain().forEach(d => this.drawPerpendicularLine(axis, innerNumScale, false, d));
  //     }
  //   });
  // };

  // TODO
  // private drawMathJaxTicks = (
  //   scale: ScaleNumeric,
  //   tickConfig: TickConfigBase<number>,
  //   tickFormatter: TickFormatter<number>,
  //   axisGElement: d3.Selection<SVGGElement, Point, null, undefined>,
  // ) => {
  //   console.warn(
  //     "enableMathJax is currently not compatible with zoom layer" +
  //     " and is only available for the x axis"
  //   );
  //   axisGElement
  //     .selectAll("g")
  //     .data(scale.ticks(tickConfig.count))
  //     .append("foreignObject")
  //     .attr("width", 50)
  //     .attr("height", 50)
  //     .attr("x", 0)
  //     .attr("y", tickConfig.padding)
  //     .append("xhtml:span")
  //     .attr("class", "tick-mathjax")
  //     .text((d, i) => tickFormatter(d, i));
  //   MathJax.typesetPromise().then(() => {
  //     const spanNodes = this.coreLayers[CoreLayer.Svg]
  //       .selectAll("span.tick-mathjax")
  //       .nodes() as HTMLSpanElement[];
  //     spanNodes.forEach(sn => {
  //       const { width } = sn.getBoundingClientRect();
  //       const foreignObject = sn.parentElement! as unknown as SVGForeignObjectElement;
  //       foreignObject.x.baseVal.value = - width / 2;
  //     });
  //   });
  // };

  // Draw a line perpendicular to the specified axis at the given position in data coordinates.
  // This line will be made up of 1 or more segments, since if the other axis is categorical,
  // inter-segment gaps are required for skipping over the padding of the categorical bands.
  // private drawPerpendicularLine = (
  //   axis: XorY,
  //   numScale: ScaleNumeric,
  //   addZoom: boolean,
  //   positionDC: number,
  //   strokeWidthPx: number = 1,
  //   color: string = "black",
  // ) => {
  //   // TODO: Skip drawing a line if the positionDC is non-positive and the scale is a log scale.
  
  //   const positionSC = numScale(positionDC);
  //   const [minSC, maxSC] = numScale.range().sort((a, b) => a - b);
  //   // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
  //   if (positionSC < minSC || positionSC > maxSC) return;
  
  //   // Get all the numerical scales for the other axis, termed the 'foreign axis'.
  //   // Categorical axes contain multiple numerical scales; non-categorical axes contain exactly one.
  //   const foreignAxis = axis === "x" ? "y" : "x";
  //   const foreignMainScale = this.prevOutput.configState.scales[foreignAxis];
  //   const foreignNumScales: ScaleNumeric[] =
  //     "categories" in foreignMainScale
  //       ? Object.values(foreignMainScale.categories)
  //       : [foreignMainScale];
  
  //   foreignNumScales.forEach(scale => {
  //     const lineSegment = this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
  //       .attr(`${axis}1`, positionSC)
  //       .attr(`${axis}2`, positionSC)
  //       .attr(`${foreignAxis}1`, scale.range()[0])
  //       .attr(`${foreignAxis}2`, scale.range()[1])
  //       .style("stroke", color).style("stroke-width", strokeWidthPx);
  
  //     if (addZoom) {
  //       const zoom = async () => {
  //         const newPositionSC = numScale(positionDC);
  //         await lineSegment.transition()
  //           .duration(animationDuration)
  //           .attr(`${axis}1`, newPositionSC)
  //           .attr(`${axis}2`, newPositionSC)
  //           .style("stroke-width", strokeWidthPx)
  //           .end();
  //       };
  //       this.zoomCallbacks.push(zoom);
  //     }
  //   });
  // };
}
