import * as d3 from "@/d3";
import { LayerType, OptionalLayer, CustomEvents } from "./Layer";
import { D3Selection, LayerArgs, Point, ZoomExtents } from "@/types";

export class ZoomLayer extends OptionalLayer {
  type = LayerType.Zoom;

  constructor() {
    super();
  };

  private handleZoom = async (zoomExtents: ZoomExtents, layerArgs: LayerArgs) => {
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
  };

  private handleBrushEnd = (event: d3.D3BrushEvent<Point>, brushLayer: D3Selection<SVGGElement>, layerArgs: LayerArgs) => {
    const extent = event.selection as [number, number];
    if (!extent) return;

    // removes the grey area of the brush
    brushLayer.call(event.target.move as any, null);

    const scaleX = layerArgs.scaleConfig.linearScales.x;
    const lExtent = scaleX.invert(extent[0]);
    const rExtent = scaleX.invert(extent[1]);

    const domain = scaleX.domain();

    // if it is more than a 500x zoom we don't zoom
    if (Math.abs(lExtent - rExtent) < (domain[1] - domain[0]) / 500) {
      layerArgs.coreLayers[LayerType.Svg].dispatch(CustomEvents.ZoomEnd);
      return;
    };
    this.handleZoom({ x: [lExtent, rExtent] }, layerArgs);
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    
    // brushX allows the user to click and draw a rectangle that will
    // select a particular x interval and it will then fire an end event
    const d3Brush = d3.brushX<Point>()
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);
    const brushLayer = layerArgs.coreLayers[LayerType.BaseLayer].append("g")
      .attr("id", layerArgs.getHtmlId(LayerType.Zoom))
      .call(d3Brush);
    d3Brush.on("start", () => layerArgs.coreLayers[LayerType.Svg].dispatch(CustomEvents.ZoomStart));
    d3Brush.on("end", e => this.handleBrushEnd(e, brushLayer, layerArgs));

    // Respond to double click event by fully zooming out
    const { x } = layerArgs.scaleConfig.scaleExtents;
    layerArgs.coreLayers[LayerType.Svg].on("dblclick",() => this.handleZoom({ x: [x.start, x.end] }, layerArgs));
  };
};
