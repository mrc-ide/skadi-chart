import { XorY } from "@/types";
import { AllScales, CatScales, NumScales, Scales } from "../predraw/ScalesLayer";

export const scaleIsCategorical = (scale: Scales): scale is CatScales => "categories" in scale;

export const scaleIsNumerical = (scale: Scales): scale is NumScales => !scaleIsCategorical(scale);

export const scaleIsNestedCategorical = (scale: Scales) =>
  scaleIsCategorical(scale) && Object.values(scale.categories).some(scaleIsCategorical);

// Returns all non-empty root scales on the given axis, for both start and end positions.
export const getScalesOnAxis = (axis: XorY, scales: AllScales): Scales[] => {
  const { start, end } = scales[axis];
  return [start, end].filter(s => Object.values(s).length > 0);
};
