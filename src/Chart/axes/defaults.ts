import * as d3 from "@/d3";
import { AxisConfiguration, BaseAxisConfiguration, TickConfig } from "./types";

const baseAxisConfiguration: BaseAxisConfiguration = {
  show: true,
  label: { text: "", translate: 0 },
  translate: 0,
};

const defTickCfg = {
  translate: 0,
  size: 8,
  enableMathJax: false,
};

const defCatTickCfg = {
  ...defTickCfg,
  formatter: val => val.toString(),
} as const satisfies TickConfig<string>;

const defNumTickCfg = {
  ...defTickCfg,
  count: 10,
  // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
  formatter: val => d3.format(".2~s")(val),
} as const satisfies TickConfig<number>;

export const defNumAxis: AxisConfiguration = {
  type: "numerical" as const,
  domain: [],
  drawOrigin: true,
  tick: defNumTickCfg,
  ...baseAxisConfiguration,
}

export const defCatAxis: AxisConfiguration = {
  type: "categorical" as const,
  domain: [],
  innerPadding: 0,
  tick: defCatTickCfg,
  borders: { strokeWidth: 0 },
  ...baseAxisConfiguration,
};

export const chartDefs = {
  numerical: defNumAxis,
  categorical: defCatAxis,
}
