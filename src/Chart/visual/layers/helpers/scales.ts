import { CatScales, NumScales, Scales } from "../predraw/ScalesLayer";

export const scaleIsCategorical = (scale: Scales): scale is CatScales => "categories" in scale;

export const scaleIsNumerical = (scale: Scales): scale is NumScales => !scaleIsCategorical(scale);

export const scaleIsNestedCategorical = (scale: Scales) =>
  scaleIsCategorical(scale) && Object.values(scale.categories).some(scaleIsCategorical);
