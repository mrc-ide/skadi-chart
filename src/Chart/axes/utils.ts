import { XorY } from "@/types";
import { CurrAxisNoNone, StartOrEnd } from "./types";

export type AxPos = { axis: XorY, position: StartOrEnd }

const axisToAxPos: Record<CurrAxisNoNone, AxPos> = {
  xBottom: { axis: "x", position: "start" },
  xTop: { axis: "x", position: "end" },
  yLeft: { axis: "y", position: "start" },
  yRight: { axis: "y", position: "end" },
}

export const userAxisToAxPos = (userAxis: CurrAxisNoNone) => axisToAxPos[userAxis];

export const axPosToUserAxis = ({ axis, position }: AxPos): CurrAxisNoNone => {
  if (axis === "x" && position === "start") return "xBottom";
  if (axis === "x" && position === "end") return "xTop";
  if (axis === "y" && position === "start") return "yLeft";
  if (axis === "y" && position === "end") return "yRight";
  throw new Error("Not a valid axis or position");
};

export const deepCopy = <T>(obj: T) => {
  return JSON.parse(JSON.stringify(obj)) as T;
};
