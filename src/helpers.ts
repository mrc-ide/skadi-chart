import { LayerArgs, ScaleNumeric, XY } from "./types";

// Given a bands config for a line or point, return the numerical scales to use for x and y.
export const numScales = (bands: Partial<XY<string>> | undefined, layerArgs: LayerArgs): XY<ScaleNumeric> => {
  const { x: numericalScaleX, y: numericalScaleY } = layerArgs.scaleConfig.linearScales;
  const { x: categoricalScaleX, y: categoricalScaleY } = layerArgs.scaleConfig.categoricalScales;
  const { x: bandX, y: bandY } = bands || {};

  return {
    x: bandX && categoricalScaleX ? categoricalScaleX.bands[bandX] : numericalScaleX,
    y: bandY && categoricalScaleY ? categoricalScaleY.bands[bandY] : numericalScaleY,
  }
}
