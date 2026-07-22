import { ChartType } from "@/types";
import {
  DefaultCurrFlags,
  CurrFlags,
  CurrOutput,
  CurrState,
  This
} from "./types";
import { End } from "../end/End";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../visual/types";

export class Interactive<M, T extends ChartType, Flags extends CurrFlags> {
  private constructor(private prevOutput: PrevOutput<M>) {};

  static start<M, T extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput<M>
  ) {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Interactive<M, T, NewFlags>(prevOutput) as This<M, T, NewFlags>
  };

  addZoom() {
    return this as This<M, T, Flags>;
  };

  addTooltips() {
    return this as This<M, T, Flags>;
  };

  end() {
    const interactiveState: CurrState = {};
    const output = {
      ...this.prevOutput,
      interactiveState,
    } as CurrOutput<M>;
    return new End<M, T, Flags>(output);
  };
}
