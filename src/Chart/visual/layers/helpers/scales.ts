import { ScaleCategorical, ScaleNumeric } from "@/types";
import { Scales } from "../predraw/ScalesLayer";

export const scaleIsCategorical = (scale: Scales): scale is Extract<Scales, { scale: ScaleCategorical, categories: Record<string, Scales> }> =>
  Object.keys(scale).length > 0 && "categories" in scale;

export const scaleIsNumerical = (scale: Scales): scale is Extract<Scales, { scale: ScaleNumeric }> =>
  Object.keys(scale).length > 0 && !scaleIsCategorical(scale);

export const scaleIsNestedCategorical = (scale: Scales) => {
  return scaleIsCategorical(scale) && Object.values(scale.categories).some(scaleIsCategorical);
};

export const noDescendantIsNumerical = (scale: Scales) => {
  if (scaleIsNumerical(scale)) return false;
  if (Object.keys(scale).length === 0) return true;
  return Object.values(scale.categories).every(noDescendantIsNumerical);
};

export const deepestCategoricalScale = (scale: Scales): Extract<Scales, {
  scale: ScaleCategorical,
  categories: Record<string, Scales>,
}> | null => {
  if (!scaleIsCategorical(scale)) return null;
  const nested = Object.values(scale.categories).map(deepestCategoricalScale).filter(s => s !== null);
  return nested.length ? nested[0] : scale;
};