import * as d3 from "@/d3";
import { Layer } from "@/Chart/visual/layers/Layer";
import { CoreLayer, PredrawLayer, CurrOutput as PrevOutput } from "@/Chart/visual/types";
import { getInner } from "@/Chart/html/utils";
import { InteractiveLayer } from "../types";
import { D3Selection, Point, ScaleNumeric } from "@/types";
import { makeObjXYStartEnd } from "@/helpers";
import { ZoomProperties } from "@/Chart/visual/layers/predraw/PredrawLayer";

export class ZoomLayer extends Layer {
  private zooming = false;
  private brushLayer: D3Selection<SVGGElement> | null = null;
  private selectionMask: D3Selection<SVGRectElement> | null = null;
  private overlay: D3Selection<SVGRectElement> | null = null;

  constructor(private prevOutput: PrevOutput) {
    super();
  };

  draw = () => {
    // TODO disable zoom when categorical is enabled in any axis

    const { bounds, getHtmlId } = this.prevOutput.baseState;
    const { x: xInner, y: yInner } = getInner(bounds);

    const { coreLayers, predrawLayers, visualLayers } = this.prevOutput.visualState;
    const svg = coreLayers[CoreLayer.Svg];
    const baseLayer = coreLayers[CoreLayer.BaseLayer];
    
    // brushX allows the user to click and draw a rectangle that will
    // select a particular x interval and it will then fire an end event
    const d3Brush = d3.brush<Point>()
      .extent([[xInner.start, yInner.start], [xInner.end, yInner.end]]);
    this.brushLayer = baseLayer.append("g")
      .attr("id", `brush-${getHtmlId(InteractiveLayer.Zoom)}`)
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
    const overlayMaskId = `overlay-${getHtmlId(InteractiveLayer.Zoom)}`;
    svg.select("defs").append("svg:mask")
      .attr("id", overlayMaskId)
      .append("svg:rect")
      .attr("width", xInner.size)
      .attr("height", yInner.size)
      .attr("x", xInner.start)
      .attr("y", yInner.start)
      .attr("fill", "white")
      .attr("fill-opacity", 0.15)
      .style("mask-type", "alpha");

    const selectionMaskId = `selection-${getHtmlId(InteractiveLayer.Zoom)}`;
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
      .attr("width", xInner.size)
      .attr("height", yInner.size)
      .attr("x", xInner.start)
      .attr("y", yInner.start)
      .style("display", "none")
      .style("mask-image", `url(#${overlayMaskId}), url(#${selectionMaskId})`)
      .style("mask-composite", "subtract") as any as D3Selection<SVGRectElement>;
    

    d3Brush.on("start", () => {
      Object.values(predrawLayers).forEach(l => l?.brushStart());
      Object.values(visualLayers).forEach(l => l?.brushStart());
    });
    d3Brush.on("brush", this.handleBrushMove);
    d3Brush.on("end", this.handleBrushEnd);

    // Respond to double click event by fully zooming out
    const zoomBounds = makeObjXYStartEnd((ax, pos) => {
      const cfgArr = this.prevOutput.chartCfg[ax][pos];
      if (cfgArr.length === 1 && cfgArr[0].type === "numerical") {
        return cfgArr[0].domain as [number, number];
      } else {
        return null;
      }
    });

    const dblClickZoomProperties: ZoomProperties = {
      ...zoomBounds,
      eventType: "dblclick"
    };

    // TODO add lock y and x axis
    // if (this.options.lockAxis === "y") {
    //   dblClickZoomProperties.y = scaleY.domain() as [number, number];
    // }
    // if (this.options.lockAxis === "x") {
    //   dblClickZoomProperties.x = scaleX.domain() as [number, number];
    // }

    svg.on("dblclick",() => this.handleZoom(dblClickZoomProperties));
  };

  // This snaps the selection to x zoom if y coordinates of the user selection
  // are closer than the threshold and y zoom if the x coordinates are within
  // the threshold. The threshold is in pixels
  private processSelection = (event: d3.D3BrushEvent<Point>) => {
    const { x: xInner, y: yInner } = getInner(this.prevOutput.baseState.bounds);
    const [[x0, y0], [x1, y1]] = event.selection! as [[number, number], [number, number]];
    const zoom1dThreshold = 30;
    const distX = Math.abs(x0 - x1);
    const distY = Math.abs(y0 - y1);

    // the return value is in the form [topLeftCoord, bottomRightCoord]
    //
    // TODO lock x and y axis
    // if (this.options.lockAxis === "y") {
    //   return [[x0, margin.top], [x1, height - margin.bottom]];
    // } else if (this.options.lockAxis === "x") {
    //   return [[margin.left, y0], [width - margin.right, y1]];
    // }

    if (distX > zoom1dThreshold && distY <= zoom1dThreshold) {
      return [[x0, yInner.start], [x1, yInner.end]];
    } else if (distX <= zoom1dThreshold && distY > zoom1dThreshold) {
      return [[xInner.start, y0], [xInner.end, y1]];
    } else {
      return [[x0, y0], [x1, y1]];
    }
  };

  private handleBrushMove = (e: d3.D3BrushEvent<Point>) => {
    if (!e.selection) return;
    this.overlay!.style("display", "");
    const [[x0, y0], [x1, y1]] = this.processSelection(e);
    this.selectionMask!
      .attr("x", Math.min(x0, x1))
      .attr("y", Math.min(y0, y1))
      .attr("width", Math.abs(x0 - x1))
      .attr("height", Math.abs(y0 - y1));
  };

  handleZoom = async (zoomProperties: ZoomProperties) => {
    if (this.zooming) return;
    this.zooming = true;

    const { predrawLayers, visualLayers } = this.prevOutput.visualState;
    Object.values(predrawLayers).forEach(l => l?.beforeZoom(zoomProperties));
    Object.values(visualLayers).forEach(l => l?.beforeZoom(zoomProperties));

    const promises: Promise<void>[] = [];
    Object.values(predrawLayers).forEach(l => l && promises.push(l.zoom(zoomProperties)));
    Object.values(visualLayers).forEach(l => l && promises.push(l.zoom(zoomProperties)));
    await Promise.all(promises);

    Object.values(predrawLayers).forEach(l => l?.afterZoom(zoomProperties));
    Object.values(visualLayers).forEach(l => l?.afterZoom(zoomProperties));
    this.zooming = false;
  };

  private handleBrushEnd = (e: d3.D3BrushEvent<Point>) => {
    this.overlay!.style("display", "none")
    this.selectionMask!
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0);

    const { predrawLayers, visualLayers } = this.prevOutput.visualState;
    if (!e.selection) {
      Object.values(predrawLayers).forEach(l => l?.afterZoom(null));
      Object.values(visualLayers).forEach(l => l?.afterZoom(null));
      return;
    }

    // removes the grey area of the brush
    this.brushLayer!.call(e.target.move as any, null);

    const [[x0, y0], [x1, y1]] = this.processSelection(e);

    // if selection is smaller than 10 pixels in width or height don't zoom as
    // user may have made a mistake
    const zoomMinPixelThreshold = 10;
    if (Math.abs(x0 - x1) < zoomMinPixelThreshold || Math.abs(y0 - y1) < zoomMinPixelThreshold) {
      Object.values(predrawLayers).forEach(l => l?.afterZoom(null));
      Object.values(visualLayers).forEach(l => l?.afterZoom(null));
      return;
    };

    const { scales } = this.prevOutput.visualState.predrawLayers[PredrawLayer.Scales]!;
    // TODO just return xy startend type from processSelection instead of
    // [[number, number], [number, number]]
    const selectionBounds = {
      x: { start: [x0, x1], end: [x0, x1] },
      y: { start: [y1, y0], end: [y1, y0] },
    };

    const zoomBounds = makeObjXYStartEnd((ax, pos) => {
      const cfgArr = this.prevOutput.chartCfg[ax][pos];
      if (cfgArr.length === 1 && cfgArr[0].type === "numerical") {
        const scale = scales[ax][pos].scale as ScaleNumeric;
        return selectionBounds[ax][pos].map(scale.invert) as [number, number];
      } else {
        return null;
      }
    });

    const zoomProperties: ZoomProperties = {
      ...zoomBounds,
      eventType: "brush"
    };
    this.handleZoom(zoomProperties);
  };
}
