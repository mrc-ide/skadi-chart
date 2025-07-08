import * as d3 from "@/d3";
import { LayerType, OptionalLayer, CustomEvents } from "./Layer";
import { D3Selection, LayerArgs, Point, ZoomExtents } from "@/types";

export class ZoomLayer extends OptionalLayer {
  type = LayerType.Zoom;
  zooming = false;

  constructor() {
    super();
  };

  private handleZoom = async (zoomExtents: ZoomExtents, layerArgs: LayerArgs) => {
    if (this.zooming) return;
    this.zooming = true;

    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;

    layerArgs.optionalLayers.forEach(layer => layer.beforeZoom(zoomExtents));

    // updates the scales which are implicitly used by a lot of other
    // components
    if (zoomExtents.x) scaleX.domain(zoomExtents.x);
    if (zoomExtents.y) scaleY.domain(zoomExtents.y);

    const promises: Promise<void>[] = [];
    layerArgs.optionalLayers.forEach(layer => promises.push(layer.zoom(zoomExtents)));
    await Promise.all(promises);

    layerArgs.coreLayers[LayerType.Svg].dispatch(CustomEvents.ZoomEnd);
    this.zooming = false;
  };

  private handleBrushEnd = (event: d3.D3BrushEvent<Point>, brushLayer: D3Selection<SVGGElement>, layerArgs: LayerArgs) => {
    const extent = event.selection as [[number, number], [number, number]];
    if (!extent) return;

    // removes the grey area of the brush
    brushLayer.call(event.target.move as any, null);

    const [[x0, y0], [x1, y1]] = extent;

    const scaleX = layerArgs.scaleConfig.linearScales.x;
    const extentXStart = scaleX.invert(x0);
    const extentXEnd = scaleX.invert(x1);

    const scaleY = layerArgs.scaleConfig.linearScales.y;
    const extentYStart = scaleY.invert(y1);
    const extentYEnd = scaleY.invert(y0);

    const { scaleExtents } = layerArgs.scaleConfig;
    const minDistX = Math.abs(scaleExtents.x.start - scaleExtents.x.end) / 500;
    const minDistY = Math.abs(scaleExtents.y.start - scaleExtents.y.end) / 500;

    // if it is more than a 500x zoom we don't zoom
    if (Math.abs(extentXStart - extentXEnd) < minDistX || Math.abs(extentYStart - extentYEnd) < minDistY) {
      layerArgs.coreLayers[LayerType.Svg].dispatch(CustomEvents.ZoomEnd);
      return;
    };
    this.handleZoom({ x: [extentXStart, extentXEnd], y: [extentYStart, extentYEnd] }, layerArgs);
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    
    // brushX allows the user to click and draw a rectangle that will
    // select a particular x interval and it will then fire an end event
    const d3Brush = d3.brush<Point>()
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);
    const brushLayer = layerArgs.coreLayers[LayerType.BaseLayer].append("g")
      .attr("id", layerArgs.getHtmlId(LayerType.Zoom))
      .call(d3Brush);
    d3Brush.on("start", () => layerArgs.coreLayers[LayerType.Svg].dispatch(CustomEvents.ZoomStart));
    d3Brush.on("end", e => this.handleBrushEnd(e, brushLayer, layerArgs));

    // Respond to double click event by fully zooming out
    const { x, y } = layerArgs.scaleConfig.scaleExtents;
    layerArgs.coreLayers[LayerType.Svg]
      .on("dblclick",() => this.handleZoom({ x: [x.start, x.end], y: [y.start, y.end] }, layerArgs));
  };
};
