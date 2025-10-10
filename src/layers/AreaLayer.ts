// Plan: make 'whether the area has a border' optional (and don't implement this at first)

// AreaLayer can get the low res lines from TracesLayer

import { AreaLineConfig, AreaLines, LayerArgs, Point, RDPOptions, ScaleNumeric, XY, ZoomExtents } from "@/types";
import { LayerType } from "./Layer";
import { numScales } from "@/helpers";
import { LinesLayer } from "./LinesLayer";

export type AreaOptions = RDPOptions;

export class AreaLayer<Metadata> extends LinesLayer<Metadata> {
  type = LayerType.Area;

  constructor(public linesDC: AreaLines<Metadata>, public options: AreaOptions) {
    super(linesDC, options);
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
    return this.paths[index]
      .transition()
      .duration(layerArgs.globals.animationDuration)
      .attrTween("d", () => this.areaCustomTween(index, zoomExtentsSC))
      .end();
  };

  protected replacePathsAfterZoom = (zoomExtentsSC: ZoomExtents, layerArgs: LayerArgs) => {
    this.linesDC.forEach((_line, index) => {
      const yOriginAfterZoomSC = layerArgs.scaleConfig.linearScales.y(0);
      const linePathSC = this.customLineGen(this.lowResLinesSC[index], zoomExtentsSC);

      const currLineSC = this.lowResLinesSC[index];

      const linePathWithYOriginPointsOnIt = this.getNewSvgPoint({ ...currLineSC[0], y: yOriginAfterZoomSC }, "M")
        + "L" + linePathSC.substring(1)
        + this.getNewSvgPoint({ ...currLineSC[currLineSC.length - 1], y: yOriginAfterZoomSC }, "L")
        + "Z";

      this.paths[index].attr("d", linePathWithYOriginPointsOnIt)
    });
  };
}
