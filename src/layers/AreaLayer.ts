// An area is applied to a trace if the line is configured with `fillArea` as true.
// It reuses the line points from the trace layer to draw a filled area under the line.

import { D3Selection, LayerArgs, Point, ZoomExtents } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { numScales } from "@/helpers";
import { customLineGen, getNewSvgPoint } from "@/customLineGen";

export class AreaLayer<Metadata> extends OptionalLayer {
  type = LayerType.Area;
  // todo - see if we can drop nulls - though they may be needed for corresponding with traceslayer.
  private paths: Array<D3Selection<SVGPathElement> | null> = [];
  protected preZoomYOriginSC: number | null = null;

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
      const linePathSC = customLineGen(currLineSC, currentExtentsSC, true);

      // todo: does this become scales.y(0) for bands?
      const yOriginSC = layerArgs.scaleConfig.linearScales.y(0);
      const firstYOriginPoint = { ...currLineSC[0], y: yOriginSC };
      const lastYOriginPoint = { ...currLineSC[currLineSC.length - 1], y: yOriginSC };

      return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
        .attr("id", `${layerArgs.getHtmlId(LayerType.Area)}-${index}`)
        .attr("pointer-events", "none")
        .attr("fill", lineDC.style.color || "black")
        .attr("stroke", "none")
        .attr("opacity", lineDC.style.opacity ? lineDC.style.opacity / 2 : 0.5)
        .attr("d", this.closedSVGPath(linePathSC, firstYOriginPoint, lastYOriginPoint));
    });

    this.beforeZoom = () => {
      // todo - get correct scale when using bands
      this.preZoomYOriginSC = layerArgs.scaleConfig.linearScales.y(0);
    }

    this.zoom = async (zoomExtentsDC: ZoomExtents) => {
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      const zoomExtentsSC: ZoomExtents = {
        x: [scaleX(zoomExtentsDC.x[0]), scaleX(zoomExtentsDC.x[1])],
        y: [scaleY(zoomExtentsDC.y[0]), scaleY(zoomExtentsDC.y[1])],
      };

      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.tracesLayer.linesDC.length; i++) {
        const path = this.paths[i];
        if (path) {
          const promise = path
            .transition()
            .duration(layerArgs.globals.animationDuration)
            .attrTween("d", () => this.customTween(i, zoomExtentsSC))
            .end();
          promises.push(promise);
        }
      };
      await Promise.all(promises);
    };

    this.afterZoom = (zoomExtentsDC: ZoomExtents | null) => {
      if (!zoomExtentsDC) {
        return;
      }

      // After TracesLayer zoom animation is complete, get the appropriate resolution lines which were re-calculated
      // during the TracesLayer zoom function, and replace without the user knowing.

      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      // ?      const { x, y } = layerArgs.scaleConfig.scaleExtents;

      const zoomExtentsSC: ZoomExtents = {
        x: [scaleX(zoomExtentsDC.x[0]), scaleX(zoomExtentsDC.x[1])],
        y: [scaleY(zoomExtentsDC.y[0]), scaleY(zoomExtentsDC.y[1])],
      };

      this.tracesLayer.linesDC.forEach((_line, index) => {
        const path = this.paths[index];
        if (!path) {
          return;
        }
        // todo - get correct scale when using bands
        const yOriginAfterZoomSC = layerArgs.scaleConfig.linearScales.y(0);

        const linePathSC = customLineGen(this.tracesLayer.lowResLinesSC[index], zoomExtentsSC, true);

        const currLineSC = this.tracesLayer.lowResLinesSC[index];

        const firstYOriginPoint = { ...currLineSC[0], y: yOriginAfterZoomSC };
        const lastYOriginPoint = { ...currLineSC[currLineSC.length - 1], y: yOriginAfterZoomSC };

        path.attr("d", this.closedSVGPath(linePathSC, firstYOriginPoint, lastYOriginPoint))
      });
    }
  }

  // todo - consider wrapping inside customLineGen (might let us incorporate the logic from customTween)
  private closedSVGPath = (openPath: string, firstYOriginPointSC: Point, lastYOriginPointSC: Point) => {
    // For area lines, we need to convert any open path of the TracesLayer to a closed path
    // where the first and last points are at the y-origin (filling the area between the line and the x-axis).
    return getNewSvgPoint(firstYOriginPointSC, "M")
      + "L" + openPath.substring(1) // convert the initial M to an L
      + getNewSvgPoint(lastYOriginPointSC, "L")
      + "Z";
  }

  // d3 feeds the function we return from this function with t, which goes from
  // 0 to 1 with different jumps based on your ease, t = 0 is the start state of
  // your animation, t = 1 is the end state of your animation
  private customTween = (index: number, zoomExtents: ZoomExtents) => {
    const currLineSC = this.tracesLayer.lowResLinesSC[index];
    const getNewPoint = this.tracesLayer.getNewPoint!;
    const yOriginSC = this.preZoomYOriginSC!;
    return (t: number) => {
      const intermediateLineSC = currLineSC.map(({x, y}) => getNewPoint(x, y, t));
      const intermediateLinePathSC = customLineGen(intermediateLineSC, zoomExtents, true);

      const firstYOriginPoint = getNewPoint(currLineSC[0].x, yOriginSC, t);
      const lastYOriginPoint = getNewPoint(currLineSC[currLineSC.length - 1].x, yOriginSC, t);

      return this.closedSVGPath(intermediateLinePathSC, firstYOriginPoint, lastYOriginPoint)
    }
  };
}
