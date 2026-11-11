import { scaleBand, scaleLinear } from "@/d3";
import { digNumericalScales } from "@/helpers";
import type { Scales } from "@/Chart/visual/layers/predraw/ScalesLayer";

const categorical = (categories: Record<string, Scales>): Scales => ({
  scale: scaleBand<string>().domain(Object.keys(categories)),
  categories,
});

describe("digScale", () => {
  test("returns a numerical root unchanged", () => {
    const scale = scaleLinear();

    expect(digNumericalScales({ scale })).toEqual([scale]);
    expect(digNumericalScales({ scale })[0]).toBe(scale);
  });

  test("collects numerical scales nested within two levels of categorical scales", () => {
    const first = scaleLinear();
    const second = scaleLinear();
    const third = scaleLinear();
    const scales = categorical({
      a: categorical({ one: { scale: first }, two: { scale: second } }),
      b: categorical({ three: { scale: third } }),
    });

    expect(digNumericalScales(scales)).toEqual([first, second, third]);
  });

  test("collects numerical scales directly below a categorical root", () => {
    const first = scaleLinear();
    const second = scaleLinear();
    const scales = categorical({
      a: { scale: first },
      b: { scale: second },
    });

    expect(digNumericalScales(scales)).toEqual([first, second]);
  });
});
