import * as d3 from "@/d3";
import { Layer } from "@/Chart/visual/layers/Layer";
import { ScaleCategorical, ScaleNumeric, XorY } from "@/types";
import { CurrOutput as PrevOutput } from "@/Chart/config/types";
import { CoreLayer, CoreLayers, PredrawLayer, PredrawLayers, VisualLayer } from "../types";
import { getInner } from "@/Chart/html/utils";
import { AxisUtil, digNumericalScales, doXYStartEnd, makeObjXY, PositionUtil } from "@/helpers";
import { Scales } from "./predraw/ScalesLayer";
import { AxisConfiguration } from "@/Chart/axes/types";

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

  zoom = async () => {
    await Promise.all(this.zoomCallbacks.map(f => f()));
  };

  draw = () => {
    const axesCfg = this.prevOutput.axesCfg;
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
        // TODO: Skip drawing an origin line if the scale is a log scale.
        const s = scale.scale as ScaleNumeric
        this.drawPerpendicularLine(s(0), s, axis, 0.5);
      }

      if (currAxisCfg.border.strokeWidth) {
        scale.scale.range().forEach((sc) => {
          this.drawPerpendicularLine(sc, scale.scale, axis, currAxisCfg.border.strokeWidth);
        });
      }

      if ("categories" in scale) {
        Object.entries(scale.categories).forEach(([k, s]) => {
          recurseDraw(axis, position, `${path}-${k}`, s, restAxisCfg);
        });
      }
    };

    doXYStartEnd((ax, pos) => {
      const axis = new AxisUtil(ax);
      const position = new PositionUtil(pos);
      const axisCfg = position.pick(axis.pick(axesCfg));
      const scale = position.pick(axis.pick(this.scalesLayer()!.scales));
      recurseDraw(
        axis, position, `${axis.curr()}-${position.curr()}`, scale, axisCfg
      );
    });
  };

  // Draw a line perpendicular to the specified axis at the given value in screen coordinates.
  // This line will be made up of 1 or more segments, since if the other axis is categorical,
  // inter-segment gaps are required for skipping over the padding of the categorical bands.
  // This padding is called 'inner padding' by d3.
  private drawPerpendicularLine = (
    valueSC: number,
    scale: ScaleNumeric | ScaleCategorical,
    axis: AxisUtil,
    strokeWidthPx: number = 1,
    color: string = "black",
  ) => {
    // If outside of range, don't draw the line. Otherwise we might draw a line onto another band.
    const [minSC, maxSC] = scale.range().sort((a, b) => a - b);
    if (valueSC < minSC || valueSC > maxSC) return;

    // Inner paddings are implied by the numerical scales, so fetch them from the other axis.
    const otherAxisScales = axis.pickOther(this.scalesLayer()!.scales); // both positions included
    const otherNumScalesStart = digNumericalScales(otherAxisScales.start);
    const otherNumScalesEnd = digNumericalScales(otherAxisScales.end);

    // If a start scale and end scale on the same x/y axis have different inner paddings, by size or
    // by placement, then we should not try to draw perpendicular lines across the gaps,
    // as the behaviour of 'skipping the inner padding' would be undefinable.
    if (otherNumScalesStart.length > 0 && otherNumScalesEnd.length > 0) {
      // If there are two positions in use for this axis, and there is some inner padding
      // to be considered, we need to check if those gaps are consistent across both positions.

      // Get the placements and widths of the gaps for each scale
      const startScaleGaps = this.getScaleGaps(otherNumScalesStart);
      const endScaleGaps = this.getScaleGaps(otherNumScalesEnd);

      if (
        !(startScaleGaps.length === 0 && endScaleGaps.length === 0) // no issues if no padding on either position
        && JSON.stringify(startScaleGaps) !== JSON.stringify(endScaleGaps) // mismatch
      ) {
        throw new Error(`You tried to draw a border or origin on an ${axis.curr()} axis, ` +
        `but the corresponding start and end ${axis.other()}-axes have different placements or sizes ` +
        `so we cannot draw the perpendicular line safely. Check that their innerPadding configurations match.`);
      }
    }

    // Now iterate over the numerical scales and draw a line segment for each.

    // Recall that either the start or end position may be an empty array.
    // Use the first one that is non-empty - we are equanimous between start and end,
    // since by now we know that the inner padding gaps are the same for each position.
    const otherNumScales = otherNumScalesStart.length > 0 ? otherNumScalesStart : otherNumScalesEnd;
    otherNumScales.forEach(s => {
      this.coreLayers[CoreLayer.BaseLayer].append("g").append("line")
        .attr(`${axis.curr()}1`, valueSC)
        .attr(`${axis.curr()}2`, valueSC)
        .attr(`${axis.other()}1`, s.range()[0])
        .attr(`${axis.other()}2`, s.range()[1])
        .style("stroke", color).style("stroke-width", strokeWidthPx);
    });
  };

  // Get the "negative spaces" from a list of numerical scales,
  // i.e., the gaps between the ranges.
  private getScaleGaps = (scales: ScaleNumeric[]) => {
    return scales.map((s, i) => {
      if (i === 0) return null;
      const prevRange = scales[i - 1].range();
      return [prevRange[1], s.range()[0]] as [number, number];
    }).filter((gap) => !!gap).filter(([a, b]) => {
      // Filter out 'gaps' of width 0.
      return a !== b;
    });
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
