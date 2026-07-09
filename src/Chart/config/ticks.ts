import { PerAxisConfigByChartType } from "./types";
import { CurrOutput as PrevOutput } from "../data/types";
import { categoricalChartTypes } from "./scales";
import { makeObjXY } from "@/helpers";
import { ChartType } from "@/types";

const defaultNumericalSpecifier = ".2~s"; // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M

export type TickFormatter<Domain> = (value: Domain, index: number) => string
export type TickConfigBase<Domain> = {
  padding: number,
  size: number,
  formatter?: TickFormatter<Domain>
} & (Domain extends number ? {
  count: number,
  specifier: string,
  enableMathJax: boolean,
} : {})
export type TickConfigDefault = { numerical: TickConfigBase<number> }
type TickConfigCategorical = TickConfigDefault & { categorical: TickConfigBase<string> }
export type TickConfig = PerAxisConfigByChartType<TickConfigDefault, TickConfigCategorical>

type TickArgsBase<Domain> = Partial<TickConfigBase<Domain>>
type TickArgsDefault = { numerical?: TickArgsBase<number> }
type TickArgsCategorical = TickArgsDefault & { categorical?: TickArgsBase<string> }
export type TickArgs = PerAxisConfigByChartType<TickArgsDefault, TickArgsCategorical, "optional">

export const defaultTickConfig = <M>(prevOutput: PrevOutput<M>): TickConfig[ChartType] => {
  const { bounds } = prevOutput.baseState;
  return makeObjXY(axis => {
    const hasCategoricalAxis = categoricalChartTypes[axis].includes(prevOutput.chartType);
    return {
      numerical: {
        padding: hasCategoricalAxis ? 6 : 12,
        size: 0,
        count: getDefaultTickCount(axis === "x" ? bounds.width : bounds.height),
        specifier: defaultNumericalSpecifier,
        enableMathJax: false,
      },
      ...(hasCategoricalAxis ? {
        categorical: {
          padding: 30,
          size: 0,
        },
      } : {}),
    };
  });
}

const getDefaultTickCount = (size: number) => {
  if (size < 250) return 3;
  if (size < 450) return 6;
  return 10;
};
