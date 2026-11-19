import * as d3 from "@/d3";
import { Layer } from "@/Chart/visual/layers/Layer";
import { D3Selection, ScaleCategorical, ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, PredrawLayer, PredrawLayers, VisualLayer } from "../types";
import { getInner } from "@/Chart/html/utils";
import { AxisUtil, doXYStartEnd, makeObjXY, PositionUtil } from "@/helpers";
import { CatScales, NumScales, Scales } from "./predraw/ScalesLayer";
import { AxisConfiguration, ConfigurableCatAxis, ConfigurableNumAxis } from "@/Chart/axes/types";
import { ZoomProperties } from "./predraw/PredrawLayer";
import { animationDuration } from "@/Chart/interactive/constants";
import { scaleIsNumerical, scaleIsCategorical, scaleIsNestedCategorical, getScalesOnAxis } from "./helpers/scales";
import { drawSVGLine } from "./helpers/svg";

// TODO remove when adding mathjax and zoom layer
// declare const MathJax: any;

export class AxesLayer extends Layer {
  private zoomCallbacks: (() => Promise<void>)[] = [];
  private scalesLayer = () => this.predrawLayers[PredrawLayer.Scales];
  private baseLayer = () => this.coreLayers[CoreLayer.BaseLayer];

  constructor(
    private prevOutput: PrevOutput,
    private predrawLayers: PredrawLayers,
    private coreLayers: CoreLayers,
  ) {
    super();
  };

  zoom = async (_z: ZoomProperties) => {
    await Promise.all(this.zoomCallbacks.map(f => f()));
  };

  draw = () => {
    const { chart } = this.prevOutput;
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
      addZoom: boolean,
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

      if (addZoom && currAxisCfg.type === "numerical") {
        const zoom = async () => {
          await axisGElement.transition()
            .duration(animationDuration)
            .call(axisCall)
            .end();
        };
        this.zoomCallbacks.push(zoom);
      }

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

      if (scaleIsNumerical(scale)) {
        const numCfg = (currAxisCfg as ConfigurableNumAxis);
        if (numCfg.log === false && numCfg.drawOrigin) {
          this.drawOrigin(scale, axis, addZoom);
        }
      }

      if (scaleIsCategorical(scale)) {
        this.drawBordersForBands(currAxisCfg as ConfigurableCatAxis, scale, axis);

        if (restAxisCfg.length) {
          Object.entries(scale.categories).forEach(([k, s]) => {
            recurseDraw(axis, position, `${path}-${k}`, s, restAxisCfg, false);
          });
        }
      }
    };

    doXYStartEnd((ax, pos) => {
      const axis = new AxisUtil(ax);
      const position = new PositionUtil(pos);
      const c = position.pick(axis.pick(chart));
      if (!c.length) return;
      const scale = position.pick(axis.pick(this.scalesLayer()!.scales));
      recurseDraw(
        axis, position,
        `${axis.curr()}-${position.curr()}`, scale, c,
        c.length === 1
      );
    });
  };


  /*
    Draw line(s) perpendicular to the current axis at the edges of the categorical bands.
    Each border will be made up of 1 or more segments, since in some cases inter-segment gaps
    are required for skipping over the padding of the other axis' categorical bands.
    This depends on the scale types on the opposite x/y axis.

    These cover all cases (for a single position on the opposite axis):
    1) The scale on the opposite axis is numerical, and the scales tree immediately stops.
      => Draw an unbroken line.
    2) The scale on the opposite axis is categorical.
      => Draw a broken line skipping the inter-segment gaps of the root scale on the opposite axis.

    If the opposite axis has a categorical scale on both positions, we can't trivially determine
    whether both sets of bands and their gaps line up, so we draw an unbroken line. If it has exactly
    one categorical scale (and one numerical), it's not clear whether the gaps should be skipped,
    so we don't.
  */
  private drawBordersForBands = (
    { domain, borders }: ConfigurableCatAxis,
    { scale }: CatScales,
    axis: AxisUtil,
  ) => {
    const strokeWidth = borders.strokeWidth;
    if (strokeWidth === 0) return;
    const color = "black";
    domain.forEach((cat) => {
      const bandwidth = scale.bandwidth();
      const bandMinSC = scale(cat);
      if (bandMinSC === undefined) return;
      const bordersSC = scale.paddingInner() ? [bandMinSC, bandMinSC + bandwidth] : [bandMinSC];
      bordersSC.forEach((valueSC) => {
        // If outside of range, don't draw the line. Otherwise we might draw a line outside the parent scale.
        if (!this.valueInRange(valueSC, scale)) return;
        // Get root scales on the opposite axis, for both start and end positions.
        const oppScales = getScalesOnAxis(axis.other(), this.scalesLayer()!.scales);

        if (oppScales.length === 1 // There is only one position on the opposite axis for us to consider
          && scaleIsCategorical(oppScales[0])
        ) {
          // Draw a broken line over the opposite axis's root categorical scale
          Object.values(oppScales[0].categories).forEach((childScale) => {
            drawSVGLine(this.baseLayer(), valueSC, axis, childScale.scale.range(), strokeWidth, color);
          });
        } else {
          // No inter-segment gaps are required, so we can draw a single continuous line.
          // Since the line is unbroken, it doesn't matter which position we use, as long as it has a scale.
          drawSVGLine(this.baseLayer(), valueSC, axis, oppScales[0].scale.range(), strokeWidth, color);
        }
      });
    });
  };


  /*
    Draw a line perpendicular to the specified axis at the origin.
    This line will be made up of 1 or more segments, since in some cases inter-segment gaps
    are required for skipping over the padding of the other axis' categorical bands.
    This depends on the scale types on the opposite x/y axis.

    These cover all cases (for a single position):
    1) The scale on the opposite axis is numerical, so the scales tree immediately stops.
      => Draw an unbroken line.
    2) The scale on the opposite axis is categorical, but the first child scale is numerical (so tree stops).
      => Draw a broken line skipping the inter-segment gaps of the root scale on the opposite axis.
    3) The scale on the opposite axis is categorical, and contains further nested categorical scales.
      => This may be a grouped bar chart or similar, so draw an unbroken line.

    If the opposite axis has a categorical scale on both positions, we can't trivially determine
    whether both sets of bands and their gaps line up, so we draw an unbroken line. If it has exactly
    one categorical scale (and one numerical), it's not clear whether the gaps should be skipped,
    so we don't.
  */
  private drawOrigin = ({ scale: d3Scale }: NumScales, axis: AxisUtil, addZoom: boolean) => {
    const valueDC = 0;
    const strokeWidth = 0.5;
    const color = "black";
    const valueSC = d3Scale(valueDC);
    // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
    if (!this.valueInRange(valueSC, d3Scale)) return;

    // Get root scales on the opposite axis, for both start and end positions.
    const oppScales = getScalesOnAxis(axis.other(), this.scalesLayer()!.scales);

    if (oppScales.length === 1 // There is only one position on the opposite axis for us to consider
      && !scaleIsNumerical(oppScales[0])
      && !scaleIsNestedCategorical(oppScales[0])
    ) {
      // Draw a broken line over the opposite axis's root categorical scale
      Object.values(oppScales[0].categories).forEach((childScale) => {
        const segment = drawSVGLine(this.baseLayer(), valueSC, axis, childScale.scale.range(), strokeWidth, color);
        if (addZoom) this.zoomCallbacks.push(this.zoomForLine(segment, valueDC, d3Scale, axis, strokeWidth));
      });
    } else {
      // No inter-segment gaps are required, so we can draw a single continuous line.
      // Since the line is unbroken, it doesn't matter which position we use, as long as it has a scale.
      const line = drawSVGLine(this.baseLayer(), valueSC, axis, oppScales[0].scale.range(), strokeWidth, color);
      if (addZoom) this.zoomCallbacks.push(this.zoomForLine(line, valueDC, d3Scale, axis, strokeWidth));
    }
  };

  private zoomForLine = (
    line: D3Selection<SVGLineElement>,
    valueDC: number,
    d3Scale: ScaleNumeric,
    axis: AxisUtil,
    strokeWidth: number
  ) => {
    return async () => {
      const newValueSC = d3Scale(valueDC);

      await line.transition()
        .duration(animationDuration)
        .attr(`${axis.curr()}1`, newValueSC)
        .attr(`${axis.curr()}2`, newValueSC)
        .style("stroke-width", strokeWidth)
        .end();

      // Hide the line segment if it is outside the new range. Otherwise we might draw a line onto another band.
      line.style("display", this.valueInRange(newValueSC, d3Scale) ? null : "none");
    };
  }

  private valueInRange(valueSC: number, d3Scale: Scales["scale"]): boolean {
    const [minSC, maxSC] = d3Scale.range().sort((a, b) => a - b);
    return valueSC >= minSC && valueSC <= maxSC;
  }

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
}
