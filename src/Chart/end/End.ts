import { ChartType, ScaleNumeric, XorY, ZoomExtents, ZoomProperties } from "@/types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../interactive/types";
import { CoreLayer, PredrawLayer, VisualLayer } from "../visual/types";

export class End<M, _T extends ChartType, _Flags extends PrevFlags> {
  constructor(private prevOutput: PrevOutput<M>) {
    this.prevOutput.baseState.element.childNodes.forEach(n => n.remove());
    this.prevOutput.visualState.visualLayers[VisualLayer.Axes]?.draw();
    this.prevOutput.visualState.visualLayers[VisualLayer.Trace]?.draw();
    this.prevOutput.visualState.visualLayers[VisualLayer.Area]?.draw();
    this.prevOutput.baseState.element.append(
      this.prevOutput.visualState.coreLayers[CoreLayer.Svg].node()!
    );

    // TODO: Remove this zooming code once proper zoom handling is implemented
    setTimeout(async () => {
      if (this.prevOutput.chartType != "default") {
        return;
      }

      const myZoomExtents: ZoomExtents = { x: [1, 30], y: [-250, 600] };
      const zoomProps = {...myZoomExtents, eventType: "brush"} as ZoomProperties;

      this.prevOutput.visualState.predrawLayers[PredrawLayer.Lines]?.beforeZoom(zoomProps);
      this.prevOutput.visualState.visualLayers[VisualLayer.Axes]?.beforeZoom(zoomProps);

      (["x", "y"] as XorY[]).forEach(axis => {
        let numscales: ScaleNumeric[] = [];
        if ("categories" in this.prevOutput.configState.scales[axis]) {
          numscales = Object.values(this.prevOutput.configState.scales[axis].categories);
        } else if (!("categories" in this.prevOutput.configState.scales[axis])) {
          numscales = [this.prevOutput.configState.scales[axis]];
        }
        numscales.forEach(ns => ns.domain(myZoomExtents[axis]));
      });

      const predrawZoomPromises: Promise<void>[] = [];
      Object.values(this.prevOutput.visualState.predrawLayers).forEach((layer) => {
        if (!layer) return;
        predrawZoomPromises.push(layer.zoom(zoomProps));
      });

      const zoomPromises: Promise<void>[] = [];
      Object.values(this.prevOutput.visualState.visualLayers).forEach((layer) => {
        if (!layer) return;
        zoomPromises.push(layer.zoom(zoomProps));
      });

      await Promise.all(predrawZoomPromises);
      await Promise.all(zoomPromises);

      Object.values(this.prevOutput.visualState.predrawLayers).forEach((layer) => {
        layer?.afterZoom();
      });
      Object.values(this.prevOutput.visualState.visualLayers).forEach((layer) => {
        layer?.afterZoom(zoomProps);
      });
    }, 2000);
  };
}
