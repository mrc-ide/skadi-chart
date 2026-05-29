import * as d3 from "@/d3";
import { ChartType, HasAllKeys, ScaleNumeric, XY } from "@/types"
import { CurrOutput as PrevOutput, CurrState as PrevState } from "../data/types"
import { iterateAllPoints, IterateAllPointsArgs } from "../data/utils"
import { anyXY, doXY, makeObjXY } from "@/helpers"
import { SingleRange } from "../base/types";
import { Categories } from "./types";
import { getInner } from "../base/utils";

type SingleAutoScale = { start: number | "auto", end: number | "auto" }

type ScaleArgsOptional = {
  initial?: Partial<SingleRange>,
  log?: boolean,
}

export type ScaleArgs = Partial<XY<
  { extents?: Partial<SingleAutoScale> } & ScaleArgsOptional
>>

export type ScaleArgsParsed = XY<
  { extents: SingleAutoScale } & ScaleArgsOptional
>

export const getXYMinMax = <M>(
  chartType: ChartType,
  prevState: PrevState<M, ChartType>
) => {
  const minMax: XY<SingleRange> = {
    x: { start: Infinity, end: -Infinity },
    y: { start: Infinity, end: -Infinity }
  };

  iterateAllPoints<M>({
    chartType, ...prevState,
    callback: ({ point }) => {
      doXY(axis => {
        if (point[axis] < minMax[axis].start) minMax[axis].start = point[axis];
        if (point[axis] > minMax[axis].end) minMax[axis].end = point[axis];
      })
    }
  } as IterateAllPointsArgs<M>)

  return minMax;
};

const addPadding = (scale: SingleRange, paddingFactor: number, isLog: boolean) => {
  if (isLog) {
    const startLog = Math.log(scale.start);
    const endLog = Math.log(scale.end);
    const rangeLog = Math.abs(startLog - endLog);
    return {
      start: Math.exp(startLog - rangeLog * paddingFactor),
      end: Math.exp(endLog + rangeLog * paddingFactor)
    };
  } else {
    const range = Math.abs(scale.start - scale.end);
    return {
      start: scale.start - range * paddingFactor,
      end: scale.end + range * paddingFactor
    };
  }
};

export type ScaleCategory = {
  scale: d3.ScaleBand<string>,
  categories: Record<string, ScaleNumeric>
}

export type ScaleOutput = HasAllKeys<ChartType, {
  default: XY<ScaleNumeric>,
  categoricalX: { x: ScaleCategory } & { y: ScaleNumeric },
  categoricalY: { x: ScaleNumeric } & { y: ScaleCategory },
  categoricalXY: { x: ScaleCategory } & { y: ScaleCategory },
}>

export const processScaleArgs = <M>(
  args: ScaleArgsParsed, prevOutput: PrevOutput<M>, categories: Categories["categoricalXY"]
): ScaleOutput[ChartType] => {
  // get max extents
  const extents = getXYMinMax<M>(prevOutput.chartType, prevOutput.dataState);
  const paddingFactor = { x: 0.02, y: 0.03 };
  doXY(axis => {
    const userArgs = args[axis];
    extents[axis] = addPadding(extents[axis], paddingFactor[axis], !!userArgs.log);
    if (userArgs.extents.start !== "auto") {
      extents[axis].start = userArgs.extents.start;
    }
    if (userArgs.extents.end !== "auto") {
      extents[axis].end = userArgs.extents.end;
    }
  });

  // initial extents
  const initial: XY<SingleRange> = JSON.parse(JSON.stringify(extents));
  doXY(axis => {
    const userArgs = args[axis];
    if (userArgs.initial?.start) {
      initial[axis].start = userArgs.initial.start;
    }
    if (userArgs.initial?.end) {
      initial[axis].end = userArgs.initial.end;
    }
  });

  // bounds checking
  const invalidLogBounds = anyXY(axis => {
    return !!args[axis].log
      && (initial[axis].start <= 0 || initial[axis].end <= 0);
  });
  if (invalidLogBounds) {
    throw new Error(
      `You have tried to use a log scale axis but the initial scale includes 0.`
      + ` Please set the initial scale to a range that does not include 0, or`
      + ` pass "auto" to default to the auto-scale.`
    );
  }

  // base d3 scales
  const ranges = getInner(prevOutput.baseState.bounds);
  const baseScales: XY<ScaleNumeric> = makeObjXY(axis => {
    const d3Scale = args[axis].log ? d3.scaleLog : d3.scaleLinear;
    const axisRange = ranges[axis];
    const axisInitial = initial[axis];
    return d3Scale()
      .domain([ axisInitial.start, axisInitial.end ])
      .range([ axisRange.start, axisRange.end ]);
  });

  // categorical scales
  const categoricalChartTypes: XY<ChartType[]> = {
    x: ["categoricalX", "categoricalXY"],
    y: ["categoricalY", "categoricalXY"],
  }

  return makeObjXY(axis => {
    if (!categoricalChartTypes[axis].includes(prevOutput.chartType)) {
      return baseScales[axis];
    };

    const axisRange = ranges[axis];
    const d3Scale = d3.scaleBand()
      .domain(categories[axis])
      .range([ axisRange.start, axisRange.end ]);
    const categoryWidth = d3Scale.bandwidth();

    const categoriesScales = categories[axis].reduce((acc, category) => {
      const categoryStartSC = d3Scale(category)!;
      const categoryRange = axis === "x"
        ? [categoryStartSC, categoryStartSC + categoryWidth]
        : [categoryStartSC + categoryWidth, categoryStartSC];
      acc[category] = baseScales[axis].copy().range(categoryRange);
      return acc;
    }, {} as Record<string, ScaleNumeric>)

    return { scale: d3Scale, categories: categoriesScales };
  }) as ScaleOutput[ChartType];
}
