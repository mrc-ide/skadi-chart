// An area is applied to a trace if the line is configured with `fillArea` as true.
// It reuses the line points from the trace layer to draw a filled area under the line.

import { D3Selection, LayerArgs, Lines, ZoomExtents } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { numScales } from "@/helpers";
import { customLineGen, getNewSvgPoint } from "@/customLineGen";

export class AreaLayer<Metadata> extends OptionalLayer {
  type = LayerType.Area;
  // todo - see if we can drop nulls - though they may be needed for corresponding with traceslayer.
  private paths: Array<D3Selection<SVGPathElement> | null> = [];

  constructor(public tracesLayer: TracesLayer<Metadata>) {
    super();
  };

  draw = (layerArgs: LayerArgs, currentExtentsDC: ZoomExtents) => {
    this.paths = this.tracesLayer.linesDC.map((lineDC, index) => {
      if (!lineDC.fillArea || layerArgs.chartOptions.logScale.y) {
        return null;
      }

      const scales = numScales(lineDC.bands, layerArgs);

      // todo: precalc some of these?
      const currentExtentsSC: ZoomExtents = {
        x: [scales.x(currentExtentsDC.x[0]), scales.x(currentExtentsDC.x[1])],
        y: [scales.y(currentExtentsDC.y[0]), scales.y(currentExtentsDC.y[1])],
      };

      const currLineSC = this.tracesLayer.lowResLinesSC[index];
      const linePathSC = customLineGen(currLineSC, currentExtentsSC, lineDC.fillArea);

      // todo: does this become scales.y(0) for bands?
      const yOriginSC = layerArgs.scaleConfig.linearScales.y(0);

      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Area)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", lineDC.style.color || "black")
        .attr("stroke", "none")
        .attr("opacity", lineDC.style.opacity ? lineDC.style.opacity / 2 : 0.5)
        .attr("d", this.closeSVGPath(linePathSC, currLineSC, yOriginSC));
    });
  }

  // todo - consider wrapping inside customLineGen
  private closeSVGPath = (openPath: string, currLineSC: {x: number, y: number}[], yOriginSC: number) => {
    // For area lines, we need to convert any open path of the TracesLayer to a closed path
    // where the first and last points are at the y-origin (filling the area between the line and the x-axis).
    const firstPoint = { ...currLineSC[0], y: yOriginSC };
    const lastPoint = { ...currLineSC[currLineSC.length - 1], y: yOriginSC };
    return getNewSvgPoint(firstPoint, "M")
      + "L" + openPath.substring(1) // convert the initial M to an L
      + getNewSvgPoint(lastPoint, "L")
      + "Z";
  }
}
