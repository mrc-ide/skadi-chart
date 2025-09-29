import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { D3Selection, LayerArgs, Point, ZoomProperties } from "@/types";

export type ZoomOptions = {
  lockAxis: "x" | "y" | null
}

export class ZoomLayer extends OptionalLayer {
  type = LayerType.Zoom;
  zooming = false;
  selectionMask: D3Selection<SVGRectElement> | null = null;
  overlay: D3Selection<SVGRectElement> | null = null;

  constructor(public options: ZoomOptions) {
    super();
  };

  // This snaps the selection to x zoom if y coordinates of the user selection
  // are closer than the threshold and y zoom if the x coordinates are within
  // the threshold. The threshold is in pixels
  private processSelection = (event: d3.D3BrushEvent<Point>, layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const [[x0, y0], [x1, y1]] = event.selection! as [[number, number], [number, number]];
    const zoom1dThreshold = 30;
    const distX = Math.abs(x0 - x1);
    const distY = Math.abs(y0 - y1);

    // the return value is in the form [topLeftCoord, bottomRightCoord]
    if (this.options.lockAxis === "y") {
      return [[x0, margin.top], [x1, height - margin.bottom]];
    } else if (this.options.lockAxis === "x") {
      return [[margin.left, y0], [width - margin.right, y1]];
    } else if (distX > zoom1dThreshold && distY <= zoom1dThreshold) {
      return [[x0, margin.top], [x1, height - margin.bottom]];
    } else if (distX <= zoom1dThreshold && distY > zoom1dThreshold) {
      return [[margin.left, y0], [width - margin.right, y1]];
    } else {
      return [[x0, y0], [x1, y1]];
    }
  };

  private handleZoom = async (zoomProperties: ZoomProperties, layerArgs: LayerArgs) => {
    if (this.zooming) return;
    this.zooming = true;

    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;

    layerArgs.optionalLayers.forEach(layer => layer.beforeZoom(zoomProperties));

    // updates the scales which are implicitly used by a lot of other
    // components
    if (zoomProperties.x) scaleX.domain(zoomProperties.x);
    if (zoomProperties.y) scaleY.domain(zoomProperties.y);

    const promises: Promise<void>[] = [];
    layerArgs.optionalLayers.forEach(layer => promises.push(layer.zoom(zoomProperties)));
    await Promise.all(promises);

    layerArgs.optionalLayers.forEach(layer => layer.afterZoom(zoomProperties));
    this.zooming = false;
  };

  private handleBrushEnd = (event: d3.D3BrushEvent<Point>, brushLayer: D3Selection<SVGGElement>, layerArgs: LayerArgs) => {
    this.overlay!.style("display", "none")
    this.selectionMask!
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0);

    if (!event.selection) {
      layerArgs.optionalLayers.forEach(layer => layer.afterZoom(null));
      return;
    }

    // removes the grey area of the brush
    brushLayer.call(event.target.move as any, null);

    const [[x0, y0], [x1, y1]] = this.processSelection(event, layerArgs);

    const scaleX = layerArgs.scaleConfig.linearScales.x;
    const extentXStart = scaleX.invert(x0);
    const extentXEnd = scaleX.invert(x1);

    const scaleY = layerArgs.scaleConfig.linearScales.y;
    const extentYStart = scaleY.invert(y1);
    const extentYEnd = scaleY.invert(y0);

    // if selection is smaller than 10 pixels in width or height don't zoom as
    // user may have made a mistake
    const zoomMinPixelThreshold = 10;
    if (Math.abs(x0 - x1) < zoomMinPixelThreshold || Math.abs(y0 - y1) < zoomMinPixelThreshold) {
      layerArgs.optionalLayers.forEach(layer => layer.afterZoom(null));
      return;
    };
    const zoomProperties: ZoomProperties = {
      x: [extentXStart, extentXEnd],
      y: [extentYStart, extentYEnd],
      eventType: "brush"
    };
    this.handleZoom(zoomProperties, layerArgs);
  };

  private handleBrushMove = (event: d3.D3BrushEvent<Point>, layerArgs: LayerArgs) => {
    if (!event.selection) return;
    this.overlay!.style("display", "");
    const [[x0, y0], [x1, y1]] = this.processSelection(event, layerArgs);
    this.selectionMask!
      .attr("x", Math.min(x0, x1))
      .attr("y", Math.min(y0, y1))
      .attr("width", Math.abs(x0 - x1))
      .attr("height", Math.abs(y0 - y1));
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const svg = layerArgs.coreLayers[LayerType.Svg];
    
    // brushX allows the user to click and draw a rectangle that will
    // select a particular x interval and it will then fire an end event
    const d3Brush = d3.brush<Point>()
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);
    const brushLayer = layerArgs.coreLayers[LayerType.BaseLayer].append("g")
      .attr("id", `${layerArgs.getHtmlId(LayerType.Zoom)}-brush`)
      // we hide the default brush layer and implement our own because
      // we would like additional behaviour such as visually showing a
      // 1D zoom if the selection has similar x or y coordinates
      .style("opacity", 0)
      .call(d3Brush);

    // below is the overlay mask that is the entire graph view, the selection
    // mask which is a rectangle that is the shape of the current user selection
    // and finally the overlay rect subtracts the selection mask from the
    // overlay mask to get the "cut out" effect we want where the user selection
    // is transparent and everything else is greyed
    // 
    // note: fill white actually equates to 1 alpha value and fill black to 0
    // meaning that we get a translucent black overlay by using a mask with
    // fill white and opacity set, the selection mask then subtracts everything
    // from our overlay because it has fill black and gives an alpha value of 0
    // in the user selection
    const overlayMaskId = `${layerArgs.getHtmlId(LayerType.Zoom)}-overlay`;
    svg.select("defs").append("svg:mask")
      .attr("id", overlayMaskId)
      .append("svg:rect")
      .attr("width", width - margin.right - margin.left)
      .attr("height", height - margin.bottom - margin.top)
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("fill", "white")
      .attr("fill-opacity", 0.15)
      .style("mask-type", "alpha");

    const selectionMaskId = `${layerArgs.getHtmlId(LayerType.Zoom)}-selection`;
    this.selectionMask = svg.select("defs").append("svg:mask")
      .attr("id", selectionMaskId)
      .append("svg:rect")
      .attr("width", 0)
      .attr("height", 0)
      .attr("x", 0)
      .attr("y", 0)
      .attr("fill", "white")
      .style("mask-type", "alpha") as any as D3Selection<SVGRectElement>;

    this.overlay = svg.append("svg:rect")
      .attr("width", width - margin.right - margin.left)
      .attr("height", height - margin.bottom - margin.top)
      .attr("x", margin.left)
      .attr("y", margin.top)
      .style("display", "none")
      .style("mask-image", `url(#${overlayMaskId}), url(#${selectionMaskId})`)
      .style("mask-composite", "subtract") as any as D3Selection<SVGRectElement>;
    

    d3Brush.on("start", () => layerArgs.optionalLayers.forEach(l => l.brushStart()));
    d3Brush.on("brush", e => this.handleBrushMove(e, layerArgs));
    d3Brush.on("end", e => this.handleBrushEnd(e, brushLayer, layerArgs));

    // Respond to double click event by fully zooming out
    const { x, y } = layerArgs.scaleConfig.scaleExtents;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const dblClickZoomProperties: ZoomProperties = {
      x: [x.start, x.end],
      y: [y.start, y.end],
      eventType: "dblclick"
    };

    if (this.options.lockAxis === "y") {
      dblClickZoomProperties.y = scaleY.domain() as [number, number];
    }
    if (this.options.lockAxis === "x") {
      dblClickZoomProperties.x = scaleX.domain() as [number, number];
    }

    layerArgs.coreLayers[LayerType.Svg]
      .on("dblclick",() => this.handleZoom(dblClickZoomProperties, layerArgs));
  };
};
