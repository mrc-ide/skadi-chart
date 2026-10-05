import { SkadiPoint } from "@/types";
import { Lines, ScatterPoints } from "./types";
import { ChartType } from "../base/chartTypes";

type PointWithMetadata<M> = SkadiPoint & { metadata?: M }

type IterateAllPointsArgsBase<M> = {
  [K in ChartType]: {
    chartType: K,
    lines: Lines<M, K>,
    scatterPoints: ScatterPoints<M, K>,
  }
}[ChartType]

type ChartTypeToCallbackArg<M> = {
  [K in ChartType]: { chartType: K, point: PointWithMetadata<M> }
}

type Callback<M> = {
  callback: (arg: ChartTypeToCallbackArg<M>[ChartType]) => void
}

export type IterateAllPointsArgs<M> = IterateAllPointsArgsBase<M> & Callback<M>

export const iterateAllPoints = <M>(args: IterateAllPointsArgs<M>) => {
  for (let i = 0; i < args.lines.length; i++) {
    const line = args.lines[i];
    for (let j = 0; j < line.points.length; j++) {
      const point = line.points[j];
      const base = { ...point, metadata: line.metadata };
      args.callback({ chartType: args.chartType, point: base });
    }
  }

  for (let i = 0; i < args.scatterPoints.length; i++) {
    const point = args.scatterPoints[i];
    const base = { x: point.x, y: point.y, metadata: point.metadata };
    args.callback({ chartType: args.chartType, point: base });
  }
}
