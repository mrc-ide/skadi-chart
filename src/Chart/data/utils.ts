import { CategoricalChartType, ChartType, WithExtensions, XY } from "@/types";
import { Lines, ScatterPoints } from "./types";

type PointWithMetadata<M> = XY<number> & { metadata?: M }

type IterateAllPointsArgsBase<M> = {
  [K in ChartType]: {
    chartType: K,
    lines: Lines<M, K>,
    scatterPoints: ScatterPoints<M, K>,
  }
}[ChartType]

type ChartTypeToCallbackArg<M> = WithExtensions<{
  [K in ChartType]: { point: PointWithMetadata<M> }
}, ["category", "chartType"]>

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
      if (args.chartType === "default") {
        args.callback({ chartType: args.chartType, point: base })
      } else {
        const callbackArg = {
          chartType: args.chartType,
          point: base,
          category: args.lines[i].category
        } as ChartTypeToCallbackArg<M>[CategoricalChartType];
        args.callback(callbackArg)
      }
    }
  }

  for (let i = 0; i < args.scatterPoints.length; i++) {
    const point = args.scatterPoints[i];
    const base = { x: point.x, y: point.y, metadata: point.metadata };
    if (args.chartType === "default") {
      args.callback({ chartType: args.chartType, point: base });
    } else {
      const callbackArg = {
        chartType: args.chartType,
        point: base,
        category: args.scatterPoints[i].category
      } as ChartTypeToCallbackArg<M>[CategoricalChartType];
      args.callback(callbackArg);
    }
  }
}
