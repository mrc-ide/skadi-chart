import * as d3 from "@/d3";
import { FreeDrawModeConfig } from "./mode";
import { Point } from "@/types";

const smoothingFactor = 8;

export const smoothMode: FreeDrawModeConfig = {
  canvasLine: context => d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveBasis)
    .context(context),

  svgLine: d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveBasis),

  processDrawnPoint(drawnPoint, drawnPoints) {
    if (drawnPoints.length === 0) return [drawnPoint];

    if (drawnPoint.point[0] > drawnPoints[drawnPoints.length - 1].point[0]) {
      return [ ...drawnPoints, drawnPoint ];
    } else if (drawnPoint.point[0] < drawnPoints[0].point[0]) {
      return [ drawnPoint, ...drawnPoints ];
    } else {
      return drawnPoints;
    }
  },

  filterDrawnPointsBeforePaint(drawnPoints) {
    return drawnPoints.map((p, i) => {
      if (p.type === "mousedown" || p.type === "touchstart") return p.point;
      if (Math.floor(p.point[0]) % smoothingFactor === 0 || i === drawnPoints.length - 1 || i === 0) return p.point;
      return null;
    }).filter(x => x) as [number, number][];
  },

  getPoints(scales, properties) {
    const lineLength = properties.getTotalLength();
    const numPoints = 500;
    const interval = lineLength / (numPoints - 1);

    const { x, y } = scales;
    const points: Point[] = [];

    for (let i = 0; i < numPoints; i++) {
      const point = properties.getPointAtLength(i * interval);
      points.push({ x: x.invert(point.x), y: y.invert(point.y) });
    }

    return points;
  },

  extrapolate(drawnPoints, bounds, filteredPoints) {
    if (drawnPoints.length === 0) return [];

    const { width, margin: { left, right } } = bounds;
    const startX = drawnPoints[0].point[0];
    const hasValueAtStart = startX === left;

    const endX = drawnPoints[drawnPoints.length - 1].point[0];
    const hasValueAtEnd = endX === width - right;

    if (hasValueAtStart && hasValueAtEnd) return filteredPoints;

    let extrapolatedPoints = [ ...filteredPoints ];

    const xFactor = smoothingFactor * 10;
    if (!hasValueAtStart) {
      const nPointsToAdd = Math.ceil((startX - left) / xFactor);
      const extrapolatedStartPoints = Array.from({ length: nPointsToAdd }, (_, i) => {
        return [left + i * xFactor, drawnPoints[0].point[1]] as [number, number];
      });
      extrapolatedPoints = [ ...extrapolatedStartPoints, ...extrapolatedPoints ];
    }
    if (!hasValueAtEnd) {
      const nPointsToAdd = Math.ceil((width - right - endX) / xFactor);
      const extrapolatedEndPoints = Array.from({ length: nPointsToAdd }, (_, i) => {
        return [width - right - (nPointsToAdd - 1 - i) * xFactor, drawnPoints[drawnPoints.length - 1].point[1]] as [number, number];
      });
      extrapolatedPoints = [ ...extrapolatedPoints, ...extrapolatedEndPoints ];
    }

    return extrapolatedPoints;
  }
};
