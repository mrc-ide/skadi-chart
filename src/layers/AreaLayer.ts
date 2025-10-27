import { LayerArgs, Point, ZoomExtents, ZoomProperties } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { customLineGen, getSvgRectPath, getXYMinMax, numScales } from "@/helpers";

type LineBoundaryInfo = {
  xMinDC: number,
  xMaxDC: number,
  canvasPath: Path2D,
  yCoordForXAxisSC: number,
  xMinSC: number,
  xMaxSC: number
}

export class AreaLayer<Metadata> extends OptionalLayer {
  type = LayerType.Area;

  ctx: CanvasRenderingContext2D;
  lineBoundaryInfo: (LineBoundaryInfo | null)[][] = [];

  constructor() {
    super();
    const canvas = document.createElement("canvas");
    this.ctx = canvas.getContext("2d")!;
  };

  draw(layerArgs: LayerArgs, currentExtentsDC: ZoomExtents): void {
    // no x axis in y log scale
    if (layerArgs.chartOptions.logScale.y) return;

    const traceLayers = layerArgs.optionalLayers
      .filter(l => l.type === LayerType.Trace) as TracesLayer<Metadata>[];

    this.lineBoundaryInfo = traceLayers.map(layer => layer.linesDC.map(() => null));
    const paths = traceLayers.map((layer, layerIdx) => {
      return layer.linesDC.map((line, lineIdx) => {
        if (!line.fill || line.points.length === 0) return;

        const scales = numScales(line.bands, layerArgs);
        const lineSC = layer.lowResLinesSC[lineIdx];

        const { x: xMinMax } = getXYMinMax(line.points);

        // we can just use DC points, we construct this to see if a point is in the
        // area of a line, the scale does not matter
        const pathDC = line.points.map(p => `L${p.x},${p.y}`).join("");
        const { x: firstPointX } = line.points[0];
        const firstPart = `M${firstPointX},${0}`;
        const { x: lastPointX } = line.points[line.points.length - 1];
        const lastPart = `L${lastPointX},${0}Z`;
        const closedPath = firstPart + pathDC + lastPart;
        const canvasPath = new Path2D(closedPath);

        const lineBoundaryInfo: LineBoundaryInfo = {
          // these are one time calculation
          canvasPath,
          xMinDC: xMinMax.start,
          xMaxDC: xMinMax.end,

          // these will change every time the scale changes
          yCoordForXAxisSC: scales.y(0),
          xMinSC: scales.x(xMinMax.start),
          xMaxSC: scales.x(xMinMax.end)
        };
        this.lineBoundaryInfo[layerIdx][lineIdx] = lineBoundaryInfo;

        const currentExtentsSC: ZoomExtents = {
          x: [scales.x(currentExtentsDC.x[0]), scales.x(currentExtentsDC.x[1])],
          y: [scales.y(currentExtentsDC.y[0]), scales.y(currentExtentsDC.y[1])],
        };
        const lineSegmentsSC = customLineGen(lineSC, currentExtentsSC);
        const closedLineSC = this.closeSvgPath(lineSegmentsSC, currentExtentsSC, currentExtentsDC, lineBoundaryInfo);

        return layerArgs.coreLayers[LayerType.BaseLayer].append("path")
          .attr("fill", line.style.fillColor || "black")
          .attr("opacity", line.style.fillOpacity || 0.1)
          .attr("d", closedLineSC);
      });
    });

    this.zoom = async (zoomProperties: ZoomProperties) => {
      const promises: Promise<void>[] = [];
      paths.forEach((layerPaths, layerIdx) => {
        layerPaths.forEach((p, lineIdx) => {
          if (!p) return;
      
          const promise = p
            .transition()
            .duration(layerArgs.globals.animationDuration)
            .attrTween("d", () => this.customTween(traceLayers[layerIdx], layerIdx, lineIdx, zoomProperties, layerArgs))
            .end();
          promises.push(promise);
        })
      });
      await Promise.all(promises);
    };

    this.afterZoom = (zoomExtentsDC: ZoomExtents | null) => {
      if (!zoomExtentsDC) return;

      paths.forEach((layerPaths, layerIdx) => {
        layerPaths.forEach((p, lineIdx) => {
          if (!p) return;
      
          const scales = numScales(traceLayers[layerIdx].linesDC[lineIdx].bands, layerArgs);
          const lineBoundaryInfo = this.lineBoundaryInfo[layerIdx][lineIdx]!;
          this.lineBoundaryInfo[layerIdx][lineIdx] = {
            ...lineBoundaryInfo,
            yCoordForXAxisSC: scales.y(0),
            xMinSC: scales.x(lineBoundaryInfo.xMinDC),
            xMaxSC: scales.x(lineBoundaryInfo.xMaxDC)
          };
          const zoomExtentsSC: ZoomExtents = {
            x: [scales.x(zoomExtentsDC.x[0]), scales.x(zoomExtentsDC.x[1])],
            y: [scales.y(zoomExtentsDC.y[0]), scales.y(zoomExtentsDC.y[1])],
          };
          const currLineSC = traceLayers[layerIdx].lowResLinesSC[lineIdx];
          const lineSegmentsSC = customLineGen(currLineSC, zoomExtentsSC);

          const closedPath = this.closeSvgPath(lineSegmentsSC, zoomExtentsSC, zoomExtentsDC, this.lineBoundaryInfo[layerIdx][lineIdx]!);
          p.attr("d", closedPath);
        })
      });
    };
  };

  private customTween = (traceLayer: TracesLayer<Metadata>, layerIdx: number, lineIdx: number, zoomProperties: ZoomProperties, layerArgs: LayerArgs) => {
    const currLineSC = traceLayer.lowResLinesSC[lineIdx];
    const scales = numScales(traceLayer.linesDC[lineIdx].bands, layerArgs);
    const zoomExtentsSC: ZoomExtents = {
      x: [scales.x(zoomProperties.x[0]), scales.x(zoomProperties.x[1])],
      y: [scales.y(zoomProperties.y[0]), scales.y(zoomProperties.y[1])],
    };
    const lineBoundaryInfo = this.lineBoundaryInfo[layerIdx][lineIdx]!;
    const { yCoordForXAxisSC, xMinSC, xMaxSC } = lineBoundaryInfo;

    return (t: number) => {
      const tLineSC = currLineSC.map(({x, y}) => traceLayer.getNewPoint!(x, y, t));
      const tLineSegmentsSC = customLineGen(tLineSC, zoomExtentsSC);

      const tYCoordForXAxisSC = traceLayer.getNewPoint!(0, yCoordForXAxisSC, t).y;
      const tXMinSC = traceLayer.getNewPoint!(xMinSC, 0, t).x;
      const tXMaxSC = traceLayer.getNewPoint!(xMaxSC, 0, t).x;
      const tLineBoundaryInfo: LineBoundaryInfo = {
        ...lineBoundaryInfo,
        yCoordForXAxisSC: tYCoordForXAxisSC,
        xMinSC: tXMinSC,
        xMaxSC: tXMaxSC
      };

      const tZoomTopLeftSC = traceLayer.getNewPointInverse!(zoomExtentsSC.x[0], zoomExtentsSC.y[0], t);
      const tZoomBottomRightSC = traceLayer.getNewPointInverse!(zoomExtentsSC.x[1], zoomExtentsSC.y[1], t);

      const tTopLeftSC = traceLayer.getNewPoint!(tZoomTopLeftSC.x, tZoomTopLeftSC.y, 1);
      const tBottomRightSC = traceLayer.getNewPoint!(tZoomBottomRightSC.x, tZoomBottomRightSC.y, 1);

      const tTopLeftDC = { x: scales.x.invert(tTopLeftSC.x), y: scales.y.invert(tTopLeftSC.y) };
      const tBottomRightDC = { x: scales.x.invert(tBottomRightSC.x), y: scales.y.invert(tBottomRightSC.y) };

      const tZoomExtentsDC: ZoomExtents = {
        x: [tTopLeftDC.x, tBottomRightDC.x],
        y: [tTopLeftDC.y, tBottomRightDC.y]
      };

      return this.closeSvgPath(tLineSegmentsSC, zoomExtentsSC, tZoomExtentsDC, tLineBoundaryInfo);
    };
  };

  private closeSvgPath = (lineSegmentsSC: string[], zoomExtentsSC: ZoomExtents, zoomExtentsDC: ZoomExtents, lineBoundaryInfo: LineBoundaryInfo) => {
    const { yCoordForXAxisSC, xMinSC, xMaxSC, xMinDC, xMaxDC, canvasPath } = lineBoundaryInfo;
    const [ bottomSC, topSC ] = zoomExtentsSC.y;
    const [ bottomDC, topDC ] = zoomExtentsDC.y;

    let yCoordOfXAxisBoundarySC: number;
    if (topSC < yCoordForXAxisSC && yCoordForXAxisSC < bottomSC) {
      yCoordOfXAxisBoundarySC = yCoordForXAxisSC;
    } else if (topSC >= yCoordForXAxisSC) {
      yCoordOfXAxisBoundarySC = topSC;
    } else {
      yCoordOfXAxisBoundarySC = bottomSC;
    }

    const startXBoundarySC = Math.max(zoomExtentsSC.x[0], xMinSC);
    const endXBoundarySC = Math.min(zoomExtentsSC.x[1], xMaxSC);

    const startXBoundaryDC = Math.max(zoomExtentsDC.x[0], xMinDC);
    const endXBoundaryDC = Math.min(zoomExtentsDC.x[1], xMaxDC);
    const midXBoundaryDC = (startXBoundaryDC + endXBoundaryDC) / 2;

    if (lineSegmentsSC.length === 0) {
      if (yCoordOfXAxisBoundarySC === yCoordForXAxisSC) {
        // x axis in view
        // test point above x axis and in between graph extents, if this is in area
        // color rectangle above x axis, if not color below x axis, we use DC coords
        // as the coordinates for reference
        const testPoint: Point = {
          x: midXBoundaryDC,
          y: topDC / 2
        };
        const isPointAboveXAxisInArea = this.ctx.isPointInPath(canvasPath, testPoint.x, testPoint.y);
        if (isPointAboveXAxisInArea) {
          return getSvgRectPath(startXBoundarySC, endXBoundarySC, topSC, yCoordForXAxisSC);
        } else {
          return getSvgRectPath(startXBoundarySC, endXBoundarySC, bottomSC, yCoordForXAxisSC);
        }
      } else {
        // x axis not in view so area always goes from top of box to bottom or
        // there is no area
        const testPoint: Point = {
          x: midXBoundaryDC,
          y: (topDC + bottomDC) / 2
        };
        const isPointInArea = this.ctx.isPointInPath(canvasPath, testPoint.x, testPoint.y);
        if (isPointInArea) {
          return getSvgRectPath(startXBoundarySC, endXBoundarySC, bottomSC, topSC);
        } else {
          return "";
        }
      }
    }

    const firstPointY = lineSegmentsSC[0].split("L")[0].substring(1).split(",").map(parseFloat)[1];
    const firstPart = `M${startXBoundarySC},${yCoordOfXAxisBoundarySC}L${startXBoundarySC},${firstPointY}`;

    const lastPointY = lineSegmentsSC[lineSegmentsSC.length - 1].split("L").at(-1)!.split(",").map(parseFloat)[1];
    const lastPart = `L${endXBoundarySC},${lastPointY}L${endXBoundarySC},${yCoordOfXAxisBoundarySC}Z`;

    const fullPath = lineSegmentsSC.map(seg => "L" + seg.substring(1)).join("");

    return firstPart + fullPath + lastPart;
  };
};
