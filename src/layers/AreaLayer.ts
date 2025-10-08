// Plan: make 'whether the area has a border' optional (and don't implement this at first)

import { AreaLineConfig, AreaLines, LayerArgs, Point, RDPOptions, ScaleNumeric, XY, ZoomExtents } from "@/types";
import { LayerType } from "./Layer";
import { numScales } from "@/helpers";
import { LinesLayer } from "./LinesLayer";

export type AreaOptions = RDPOptions;

const pointIsInXRange = (p: Point, zoomExtents: ZoomExtents) => {
  return zoomExtents.x[0] <= p.x && p.x <= zoomExtents.x[1];
}

export class AreaLayer<Metadata> extends LinesLayer<Metadata> {
  type = LayerType.Area;

  constructor(public linesDC: AreaLines<Metadata>, public options: AreaOptions) {
    super(linesDC, options);
  };

  protected customLineGen = (lineSC: Point[], zoomExtents: ZoomExtents, yOriginSC: number) => {
    const indexOfFirstPointInXRange = lineSC.findIndex(p => pointIsInXRange(p, zoomExtents));
    const indexOfLastPointInXRange = lineSC.length - (1 + [...lineSC].reverse().findIndex(p => pointIsInXRange(p, zoomExtents)));

    // Use the next points outside the x range, if such points exist, so that the area fills correctly to
    // the edges of the chart; otherwise just use the first and last points.
    const leftPointSC = lineSC[Math.max(indexOfFirstPointInXRange, 0)];
    const rightPointSC = lineSC[Math.min(indexOfLastPointInXRange + 1, lineSC.length - 1)];

    const pathPointsSC: Point[] = [
      { x: lineSC[0].x, y: yOriginSC },
      leftPointSC,
      ...lineSC.slice(indexOfFirstPointInXRange, indexOfLastPointInXRange + 1),
      rightPointSC,
      { x: lineSC[lineSC.length - 1].x, y: yOriginSC }
    ];

    let path = ""
    pathPointsSC.forEach(point => path += this.getNewSvgPoint(point, path ? "L" : "M"));
    return path + "Z";
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

  protected pathAnimation = (index: number, zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs): Promise<void> => {
    const yOriginSC = this.lineYOriginSC(this.linesDC[index], layerArgs);
    return this.paths[index]
      .transition()
      .duration(layerArgs.globals.animationDuration)
      .attrTween("d", () => this.customTween(index, zoomExtentsSC, yOriginSC))
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
