import * as d3 from "@/d3";
import { Layer } from "@/Chart/visual/layers/Layer";
import { ScaleCategorical, ScaleNumeric } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, PredrawLayer, PredrawLayers, VisualLayer } from "../types";
import { getInner } from "@/Chart/html/utils";
import { AxisUtil, doXYStartEnd, makeObjXY, PositionUtil } from "@/helpers";
import { Scales } from "./predraw/ScalesLayer";
import { AxisConfiguration, ConfigurableCatAxis } from "@/Chart/axes/types";
import { ZoomProperties } from "./predraw/PredrawLayer";
import { animationDuration } from "@/Chart/interactive/constants";
import { scaleIsNumerical, noDescendantIsNumerical, deepestCategoricalScale, scaleIsCategorical } from "./helpers/scales";

// TODO perpendicular lines with categorical borders and draw origins
// TODO remove when adding mathjax and zoom layer
// declare const MathJax: any;

export class AxesLayer extends Layer {
  private zoomCallbacks: (() => Promise<void>)[] = [];
  private scalesLayer = () => this.predrawLayers[PredrawLayer.Scales];

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

      if (currAxisCfg.type === "numerical" && currAxisCfg.drawOrigin) {
        // TODO: Skip drawing an origin line if the scale is a log scale.
        this.drawOrigin(scale.scale as ScaleNumeric, axis);
      }

      if (scaleIsCategorical(scale)) {
        const { borders } = currAxisCfg as ConfigurableCatAxis
        if (borders.strokeWidth) {
          this.drawBordersOfBands(scale, axis, borders.strokeWidth);
        }

        if (restAxisCfg.length) {
          Object.entries(scale.categories).forEach(([k, s]) => {
            recurseDraw(axis, position, `${path}-${k}`, s, restAxisCfg, false);
          });
        }
      }
    };

// For PR:
// I think trying to make the logic here fully generic was a mistake - it requires us to consider too many cases and decide what the user would want in each case, and I don't there's any simple logic that summarises across all those cases. Gets hard to reason about and potentially very long to account for everything. And I'd rather make things like "the inner paddings from opposite-positioned axes don't line up" the user's responsibility to avoid. I'll give them 'rope to hang themself' by letting them configure border stroke-width for their axis, come what may. If they want different lines for their use case they can draw them themselves.

// Because of the following issue:...

// > border.strokeWidth sets the stroke of the parent of axis, i.e. if i have just a categorical scale xbottom and i try and set border on that, it doesnt do borders around each category, instead it does borders around the whole chart, this isnt a problem if you assume theres a numerical scale at the leaf of the tree since you can just set the strokeWidth at that level (but not always the case as mentioned above)

// ...I'm making the border property a property of categorical axes only, so that it always refers to its children. So now it is called 'borders' plural.

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

  private drawOrigin = (scale: ScaleNumeric, axis: AxisUtil) => {
    this.drawPerpendicularLine(scale(0), scale, axis, 0.5);
  };

  private drawBordersOfBands = (
    scales: Extract<Scales, { scale: ScaleCategorical, categories: Record<string, Scales> }>,
    axis: AxisUtil,
    strokeWidth: number,
  ) => {
    Object.keys(scales.categories).forEach((k) => {
      // If the leaf scale is categorical then scale.categories is an empty object,
      // so we calculate the band start and width from its parent scale.
      const parentScale = scales.scale;
      const bandwidth = parentScale.bandwidth();
      const bandMin = parentScale(k);
      if (bandMin === undefined) return;
      const bandMax = bandMin + bandwidth;
      this.drawPerpendicularLine(bandMax, parentScale, axis, strokeWidth)
      if (parentScale.paddingInner()) {
        this.drawPerpendicularLine(bandMin, parentScale, axis, strokeWidth)
      }
    });
  };

  // Draw a line perpendicular to the specified axis at the given value in screen coordinates.
  // This line will be made up of 1 or more segments, since in some cases,
  // inter-segment gaps are required for skipping over the padding of the categorical bands.
  // This depends on the scale types on the opposite x/y axis.
  // These cover all cases (but opposite positions can have different cases):
  // 1) The scale on the opposite axis is numerical, so the scales tree immediately stops
  // 2) The scale on the opposite axis is categorical, but at depth 1 it's numerical (and tree stops).
  // 3) The scale on the opposite axis is categorical, and contains further nested categorical scales.
  private drawPerpendicularLine = (
    valueSC: number,
    scale: Scales["scale"],
    axis: AxisUtil,
    strokeWidthPx: number = 1,
    color: string = "black",
  ) => {
    // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
    const [minSC, maxSC] = scale.range().sort((a, b) => a - b);
    if (valueSC < minSC || valueSC > maxSC) return;

    const otherAxisRootScales = Object.values(axis.pickOther(this.scalesLayer()!.scales))
      .filter(({ scale }) => !!scale); // include start and end, dropping any omitted position

    // TODO: consider cases where positions on the opposite axis differ: currently
    // we skip padding by looking at only one position.
    // Simple idea: if each position has a categorical scale, don't do segmenting at all, do the continuous line.
    const useSegmentsToSkipInnerPadding = !otherAxisRootScales.every(scaleIsNumerical)
      && !otherAxisRootScales.every(noDescendantIsNumerical);

    if (useSegmentsToSkipInnerPadding) {
      Object.values(
        deepestCategoricalScale(otherAxisRootScales[0])?.categories ?? {}
      ).forEach(({ scale }) => {
        this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
          .attr(`${axis.curr()}1`, valueSC)
          .attr(`${axis.curr()}2`, valueSC)
          .attr(`${axis.other()}1`, scale.range()[0])
          .attr(`${axis.other()}2`, scale.range()[1])
          .style("stroke", color).style("stroke-width", strokeWidthPx);
      });
    } else {
      // No inter-segment gaps are required, so we can draw a single continuous line.
      this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
        .attr(`${axis.curr()}1`, valueSC)
        .attr(`${axis.curr()}2`, valueSC)
        .attr(`${axis.other()}1`, otherAxisRootScales[0].scale.range()[0])
        .attr(`${axis.other()}2`, otherAxisRootScales[0].scale.range()[1])
        .style("stroke", color).style("stroke-width", strokeWidthPx);
    }
  };

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
