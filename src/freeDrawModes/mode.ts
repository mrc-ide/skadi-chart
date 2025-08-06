import * as d3 from "@/d3";
import { Bounds, Point, XY } from "@/types";
import { svgPathProperties } from "svg-path-properties";

export enum FreeDrawMode {
  Smooth = "smooth",
}

export type DrawnPoint = {
  point: [number, number],
  type: "mousedown" | "mousemove" | "touchstart" | "touchmove"
}

export type FreeDrawModeConfig = {
  canvasLine: (context: CanvasRenderingContext2D) => d3.Line<[number, number]>,
  svgLine: d3.Line<[number, number]>,
  processDrawnPoint: (drawnPoint: DrawnPoint, drawnPoints: DrawnPoint[]) => DrawnPoint[],
  filterDrawnPointsBeforePaint: (drawnPoints: DrawnPoint[]) => [number, number][],
  getPoints: (scales: XY<d3.ScaleLinear<number, number, never>>, props: any) => Point[],
  extrapolate: (drawnPoints: DrawnPoint[], bounds: Bounds, filteredPoints: [number, number][]) => [number, number][]
}
