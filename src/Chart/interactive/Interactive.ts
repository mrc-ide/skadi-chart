import { ChartType } from "@/types";
import {
  DefaultInteractiveFlags,
  InteractiveFlags,
  InteractiveOutput,
  InteractiveState,
  This
} from "./types";
import { End } from "../end/End";
import { VisualOutput } from "../visual/types";

export class Interactive<M, T extends ChartType, Flags extends InteractiveFlags> {
  private constructor(private visualOutput: VisualOutput<M>) {};

  static start<M, T extends ChartType, PrevFlags extends InteractiveFlags>(
    visualOutput: VisualOutput<M>
  ) {
    type NewFlags = DefaultInteractiveFlags<PrevFlags>
    return new Interactive<M, T, NewFlags>(visualOutput) as This<M, T, NewFlags>
  };

  addZoom() {
    return this as This<M, T, Flags>;
  };

  addTooltips() {
    return this as This<M, T, Flags>;
  };

  end() {
    const interactiveState: InteractiveState = {};
    const output = {
      ...this.visualOutput,
      interactiveState,
    } as InteractiveOutput<M>;
    return new End<M, T, Flags>(output);
  };
}
