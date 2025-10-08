import { LayerArgs, Lines, Point, ZoomExtents, RDPOptions, D3Selection, LineConfig } from "@/types";
import { LayerType } from "./Layer";
import { LinesLayer } from "./LinesLayer";

export type TracesOptions = RDPOptions;

const pointIsInRange = (p: Point, zoomExtents: ZoomExtents) =>
  zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1]
  && zoomExtents.y[1] <= p.y && p.y <= zoomExtents.y[0]

export class TracesLayer<Metadata> extends LinesLayer<Metadata> {
  type = LayerType.Trace;

  constructor(public linesDC: Lines<Metadata>, public options: TracesOptions) {
    super(linesDC, options);
  };

  protected customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents) => {
    let retStr = "";
    let wasPrevPointInRange = pointIsInRange(lineSC[0], zoomExtents);

    for (let i = 0; i < lineSC.length; i++) {
      const isPointInRange = pointIsInRange(lineSC[i], zoomExtents);

      // if last point in range we always want to add next point even if it
      // isn't in range because we want the line to at least continue off the
      // right edge of the svg
      //
      // if the last point wasn't in range but this point is, then we must be
      // at the start of a new line segment so add the previous point too
      // because we want the line to go off the left edge of the svg
      if (wasPrevPointInRange) {
        retStr += this.getNewSvgPoint(lineSC[i], retStr ? "L" : "M");
      } else if (isPointInRange) {
        // prev point will always exist, i.e. i will never be 0 in this branch
        // because wasLastPointInRange will always match isPointInRange for
        // i = 0 so we have to fall into the previous branch
        retStr += this.getNewSvgPoint(lineSC[i - 1], "M");
        retStr += this.getNewSvgPoint(lineSC[i], "L");
      }

      wasPrevPointInRange = isPointInRange;
    }

    return retStr;
  };

  protected drawLinePath = (
    lineDC: LineConfig<Metadata>,
    linePathSC: string,
    index: number,
    layerArgs: LayerArgs
  ) => {
    return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
      .attr("id", `${layerArgs.getHtmlId(LayerType.Trace)}-${index}`)
      .attr("pointer-events", "none")
      .attr("fill", "none")
      .attr("stroke", lineDC.style.color || "black")
      .attr("opacity", lineDC.style.opacity || 1)
      .attr("stroke-width", lineDC.style.strokeWidth || 0.5)
      .attr("stroke-dasharray", lineDC.style.strokeDasharray || "")
      .attr("d", linePathSC);
  };

  protected pathAnimation = (index: number, zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs): Promise<void> => {
    return this.paths[index]
      .transition()
      .duration(layerArgs.globals.animationDuration)
      .attrTween("d", () => this.customTween(index, zoomExtentsSC))
      .end();
  };

  protected replacePathsAfterZoom = (zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs) => {
    this.paths.forEach((t, index) => {
      t.attr("d", this.customLineGen(this.lowResLinesSC[index], zoomExtentsSC))
    });
  };
}

