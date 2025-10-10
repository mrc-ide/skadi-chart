// Plan: make 'whether the area has a border' optional (and don't implement this at first)


// zooming thoughts...
// AreaLayer should split lines DC. And add a point at the y=zero for each segment.


// AreaLayer can get the low res lines from TracesLayer

import { AreaLineConfig, AreaLines, LayerArgs, Point, RDPOptions, ScaleNumeric, XY, ZoomExtents } from "@/types";
import { LayerType } from "./Layer";
import { numScales } from "@/helpers";
import { LinesLayer } from "./LinesLayer";

export type AreaOptions = RDPOptions;

const pointIsInXRange = (p: Point, zoomExtents: ZoomExtents) => {
  return zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1];
}

const pointIsInRange = (p: Point, zoomExtents: ZoomExtents) =>
  zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1]
  && zoomExtents.y[1] <= p.y && p.y <= zoomExtents.y[0]

export class AreaLayer<Metadata> extends LinesLayer<Metadata> {
  type = LayerType.Area;

  constructor(public linesDC: AreaLines<Metadata>, public options: AreaOptions) {
    super(linesDC, options);
  };

  protected customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents, yOriginSC: number, specialGetNewPoint: any, currLineSC: Point[]) => {
    const indexOfFirstPointInXRange = lineSC.findIndex(p => pointIsInRange(p, zoomExtents));
    const indexOfLastPointInXRange = lineSC.length - (1 + [...lineSC].reverse().findIndex(p => pointIsInRange(p, zoomExtents)));

    // Use the next points outside the x range, if such points exist, so that the area fills correctly to
    // the edges of the chart; otherwise just use the first and last points.
    const leftPointSC = lineSC[Math.max(indexOfFirstPointInXRange, 0)];
    const rightPointSC = lineSC[Math.min(indexOfLastPointInXRange + 1, lineSC.length - 1)];

    const pathPointsSC: Point[] = [
      // { x: lineSC[0].x, y: yOriginSC },
      // leftPointSC,
      ...lineSC,
      // ...lineSC.slice(indexOfFirstPointInXRange, indexOfLastPointInXRange + 1),
      // rightPointSC,
      // { x: lineSC[lineSC.length - 1].x, y: yOriginSC }
    ];

    let path = ""

    let retStr = "";
    let wasPrevPointInRange = pointIsInXRange(lineSC[0], zoomExtents);

    for (let i = 0; i < pathPointsSC.length; i++) {
      const isPointInRange = pointIsInXRange(pathPointsSC[i], zoomExtents);

      // if last point in range we always want to add next point even if it
      // isn't in range because we want the line to at least continue off the
      // right edge of the svg
      //
      // if the last point wasn't in range but this point is, then we must be
      // at the start of a new line segment so add the previous point too
      // because we want the line to go off the left edge of the svg
      if (wasPrevPointInRange) {
        retStr += this.getNewSvgPoint(pathPointsSC[i], retStr ? "L" : "M");
      } else if (isPointInRange) {
        // prev point will always exist, i.e. i will never be 0 in this branch
        // because wasLastPointInRange will always match isPointInRange for
        // i = 0 so we have to fall into the previous branch
        retStr += this.getNewSvgPoint(pathPointsSC[i - 1], "M");
        retStr += this.getNewSvgPoint(pathPointsSC[i], "L");
      }

      wasPrevPointInRange = isPointInRange;
    }

    if (currLineSC) {

      console.log("specialGetNewPoint(currLineSC[0].x)", specialGetNewPoint(currLineSC[0].x));
      console.log("specialGetNewPoint(currLineSC[currLineSC.length - 1].x)", specialGetNewPoint(currLineSC[currLineSC.length - 1].x));

      return this.getNewSvgPoint(specialGetNewPoint(currLineSC[0].x), "M")
        + "L" + retStr.substring(1)
        + this.getNewSvgPoint(specialGetNewPoint(currLineSC[currLineSC.length - 1].x), "L")
        + "Z";
    } else {
      return this.getNewSvgPoint({ x: lineSC[0].x, y: yOriginSC }, "M")
      + "L" + retStr.substring(1)
      + this.getNewSvgPoint({ x: lineSC[lineSC.length - 1].x, y: yOriginSC }, "L")
      + "Z";
    }

    // return path + "Z";
  };

  protected drawLinePath = (
    lineDC: AreaLineConfig<Metadata>,
    linePathSC: string, 
    index: number,
    layerArgs: LayerArgs
  ) => {
    return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
      .attr("id", `${layerArgs.getHtmlId(LayerType.Area)}-${index}`)
      .attr("pointer-events", "none")
      .attr("fill", lineDC.style.color || "black")
      .attr("stroke", "none")
      .attr("opacity", lineDC.style.opacity || 1)
      .attr("d", linePathSC);
  };

// axis zoom fixed by line-segment methodology?

  protected pathAnimation = (index: number, zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs): Promise<void> => {
    // const yOriginSC = this.lineYOriginSC(this.linesDC[index], layerArgs);
    return this.paths[index]
      .transition()
      .duration(layerArgs.globals.animationDuration)
      .attrTween("d", () => this.customTween(index, zoomExtentsSC, layerArgs))
      .end();
  };

  protected replacePathsAfterZoom = (zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs) => {
    this.linesDC.forEach((line, index) => {
      const yOriginSC = this.lineYOriginSC(line, layerArgs);
      const linePathSC = this.customLineGen(this.lowResLinesSC[index], zoomExtentsSC, yOriginSC);
      this.paths[index].attr("d", linePathSC)
    });
  };

  private lineYOriginSC = (line: AreaLineConfig<Metadata>, layerArgs: LayerArgs) => {
    return numScales(line.bands, layerArgs).y(0);
  }
}
