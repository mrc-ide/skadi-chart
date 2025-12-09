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
    // When the y axis is in log scale, 0 is an impossible value for y, so
    // there is no y = 0 line to fill to
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

        // For each line, we now create a "canvas path", which we will later
        // use for determining whether a given point lies within the inside of
        // a trace (via "isPointInPath")
        //
        // NB: The canvas and canvas paths are never rendered. They are just
        // fed into the canvas "isPointInPath" builtin. Since we only care whether
        // the point is inside or outside a curve, the scale can be anything as
        // long as we are consistent. DC doesn't change on zoom, so by choosing
        // that for our scale, we avoid the need to re-compute the canvas path.
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
          // no fill for this line
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

      /*
      The closeSvgPath method needs the zoomExtentsDC for time step t. In other words, as the graph zooms in
      we need to find out what the data coordinate (DC) is of the corners of the svg at each time step t.
      closeSvgPath then will use these boundaries to test if points are in the canvasPaths (which are in DC).
      
      To get from SC to DC, we would normally use scale.invert on D3's scale, however during the zoom, at time
      t = T, we don't know what the scales are. The only scales we have access to are those the zoom is
      targetting for at time t = 1. 

      What we do know for t = T is the zoomExtentsSC. So we need a way to get from zoomExtentsSC at t = T to
      the corresponding points at t = 1. Then we can use d3's scales for t = 1 to convert from SC to DC, giving
      us the zoomExtentsDC corresponding to the current zoomExtentsSC at t = T.

      To do this we will work out the corresponding points at time t = 0 from zoomExtentsSC at t = T using
      getNewPointInverse (go backwards) and then transform those to time t = 1 using getNewPoint (go forwards).

      Note: the zoomExtentsSC are always going to be the same, since the corners of the svg don't change their
      svg coordinates.

      An example: If we are zooming in, then the zoom extents at t = T will map to a smaller rectangle at
      t = 0: see diagram below, where X's show the corners of the zoom extents at different times (X's at time
      t = T map to a smaller box at t = 0). We can get the corners of this smaller box using
      `getNewPointInverse`:

      t = 0                              t = T                     
      __________________________         X________________________X
      |   X                X   |         |                        |
      |       __________       |         |                        |
      |      /          \      |         |                        |
      |     /            \     |   <--   |     ______________     |
      |   X/              \X   |         |    /              \    |
      |   /                \   |         |   /                \   |
      |  /                  \  |         |  /                  \  |
      | /                    \ |         | /                    \ |
      __________________________         X________________________X

      Now we can use getNewPoint on the zoom extents SC at time t = 0 and get zoom extents SC at t = 1:

      t = 0                              t = 1                     
                                       X                             X

      __________________________         __________________________
      |   X                X   |         |                        |
      |       __________       |         |                        |
      |      /          \      |         |                        |
      |     /            \     |   -->   |                        |
      |   X/              \X   |         |                        |
      |   /                \   |         |   __________________   |
      |  /                  \  |         |  /                  \  |
      | /                    \ |         | /                    \ |
      __________________________         __________________________
                                         
                                       X                            X

      Once we have these zoom extents SC in time t = 1, we can use our scales (which are also at t = 1)
      and use scale.invert to get the zoom extents DC which correspond to the zoom extents SC at time
      t = T.
      */
      const topLeftSC_0 = traceLayer.getNewPointInverse!(zoomExtentsSC.x[0], zoomExtentsSC.y[0], t);
      const bottomRightSC_0 = traceLayer.getNewPointInverse!(zoomExtentsSC.x[1], zoomExtentsSC.y[1], t);

      const topLeftSC_1 = traceLayer.getNewPoint!(topLeftSC_0.x, topLeftSC_0.y, 1);
      const bottomRightSC_1 = traceLayer.getNewPoint!(bottomRightSC_0.x, bottomRightSC_0.y, 1);

      const topLeftDC_t = { x: scales.x.invert(topLeftSC_1.x), y: scales.y.invert(topLeftSC_1.y) };
      const bottomRightDC_t = { x: scales.x.invert(bottomRightSC_1.x), y: scales.y.invert(bottomRightSC_1.y) };

      const tZoomExtentsDC: ZoomExtents = {
        x: [topLeftDC_t.x, bottomRightDC_t.x],
        y: [topLeftDC_t.y, bottomRightDC_t.y]
      };

      return this.closeSvgPath(tLineSegmentsSC, zoomExtentsSC, tZoomExtentsDC, tLineBoundaryInfo);
    };
  };

  private closeSvgPath = (lineSegmentsSC: string[], zoomExtentsSC: ZoomExtents, zoomExtentsDC: ZoomExtents, lineBoundaryInfo: LineBoundaryInfo) => {
    const { yCoordForXAxisSC, xMinSC, xMaxSC, xMinDC, xMaxDC, canvasPath } = lineBoundaryInfo;
    const [ bottomSC, topSC ] = zoomExtentsSC.y;
    const [ bottomDC, topDC ] = zoomExtentsDC.y;

    // (Remember that in SC higher y values are lower on the screen)
    // To assign `yCoordOfXAxisBoundarySC`, we choose a horizontal "boundary" to enclose
    // the fill:
    //   - if x axis is in view, we use the x axis itself
    //   - if x axis is above the top of the plot, we use the top extent as if it were the x axis
    //   - if x axis is below the bottom of the plot, we use the  bottom extent as if it were the
    //     x axis
    // The path closes the curve that the user has put by connecting the end of the curve to
    // the start along this `yCoordOfXAxisBoundarySC`.
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

    if (lineSegmentsSC.length > 0) {
      const firstPointY = lineSegmentsSC[0].split("L")[0].substring(1).split(",").map(parseFloat)[1];
      const firstPart = `M${startXBoundarySC},${yCoordOfXAxisBoundarySC}L${startXBoundarySC},${firstPointY}`;

      const lastPointY = lineSegmentsSC[lineSegmentsSC.length - 1].split("L").at(-1)!.split(",").map(parseFloat)[1];
      const lastPart = `L${endXBoundarySC},${lastPointY}L${endXBoundarySC},${yCoordOfXAxisBoundarySC}Z`;

      const fullPath = lineSegmentsSC.map(seg => "L" + seg.substring(1)).join("");

      return firstPart + fullPath + lastPart;
    }

    // Deal with cases where there are no line segments (that is, no points lie within the
    // zoomed view)
    if (yCoordOfXAxisBoundarySC === yCoordForXAxisSC) {
      // If the y coordinate of the x boundary, `yCoordOfXAxisBoundarySC`, is the same as
      // that of the x axis (line y = 0), `yCoordForXAxisSC`, then we know the x axis is in
      // view.
      //
      // Test a point above x axis and in between graph extents: if this is in area
      // color rectangle above x axis, if not color below x axis, we use DC coords
      // as the coordinates for reference
      const testPointDC: Point = {
        x: midXBoundaryDC,
        y: topDC / 2
      };
      const isPointAboveXAxisInArea = this.ctx.isPointInPath(canvasPath, testPointDC.x, testPointDC.y);
      if (isPointAboveXAxisInArea) {
        return getSvgRectPath(startXBoundarySC, endXBoundarySC, topSC, yCoordForXAxisSC);
      } else {
        return getSvgRectPath(startXBoundarySC, endXBoundarySC, bottomSC, yCoordForXAxisSC);
      }
    } else {
      // x axis not in view, so we either need a rectangle to fill the whole plot from top to bottom
      // (if we are inside a fill area), or do nothing (if we are outside a fill area).
      const testPointDC: Point = {
        x: midXBoundaryDC,
        y: (topDC + bottomDC) / 2
      };
      const isPointInArea = this.ctx.isPointInPath(canvasPath, testPointDC.x, testPointDC.y);
      if (isPointInArea) {
        return getSvgRectPath(startXBoundarySC, endXBoundarySC, bottomSC, topSC);
      } else {
        return "";
      }
    }
  };
};
