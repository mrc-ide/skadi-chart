import { AxisName } from "@/Chart/axes/types";
import { Bars, Lines } from "@/Chart/data/types";

const palette = ["#1f77b4", "#d62728", "#2ca02c", "#ff7f0e", "#9467bd"];

type GenerateWaveLinesOptions = {
  lineCount: number;
  pointCount: number;
  xDomain: { lower: number; upper: number };
  yDomain: { lower: number; upper: number };
  cycles?: number;        // sine cycles across the line
  amplitude?: number;     // wave height relative to trend (0..1 is typical)
  phaseStep?: number;     // phase offset between lines, in radians
  randomizeAmplitude?: boolean;
  opacity?: number;
  strokeWidth?: number;
};

export const generateWaveLines = ({
  lineCount,
  pointCount,
  xDomain,
  yDomain,
  cycles = 2,
  amplitude = 0.25,
  phaseStep = 2 * Math.PI / lineCount,
  randomizeAmplitude,
  opacity = 0.7,
  strokeWidth = 1.5,
}: GenerateWaveLinesOptions): Lines => {
  if (pointCount < 2) {
    throw new Error("pointCount must be >= 2");
  }
  if (xDomain.lower >= xDomain.upper || yDomain.lower >= yDomain.upper) {
    throw new Error("range min must be < max");
  }

  const useRandomAmplitude = randomizeAmplitude ?? lineCount > 10;

  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const phase = lineIndex * phaseStep;
    const lineAmplitude = useRandomAmplitude
      ? amplitude * (0.1 + Math.random() * 10)
      : amplitude;

    // 1) Generate upward-trending wave
    const raw = Array.from({ length: pointCount }, (_, i) => {
      const t = i / (pointCount - 1); // [0..1], includes both endpoints
      const upwardTrend = t;
      const wave = lineAmplitude * Math.sin(2 * Math.PI * cycles * t + phase);
      return upwardTrend + wave;
    });

    // 2) Normalize so y exactly spans full configured range
    let rawMin = Infinity;
    let rawMax = -Infinity;
    for (const value of raw) {
      rawMin = Math.min(rawMin, value);
      rawMax = Math.max(rawMax, value);
    }
    const rawSpan = rawMax - rawMin || 1;

    const points = raw.map((rawY, i) => {
      const t = i / (pointCount - 1);

      const x = xDomain.lower + t * (xDomain.upper - xDomain.lower); // full x range
      const y01 = (rawY - rawMin) / rawSpan;
      const y = yDomain.lower + y01 * (yDomain.upper - yDomain.lower); // full y range

      return { x: [x], y: [y] };
    });

    return {
      points,
      style: {
        strokeColor: palette[lineIndex % palette.length],
        opacity,
        strokeWidth,
      },
    };
  });
};

export const barchartCats1Level1 = ["A", "B", "C", "D", "E", "F"];
export const barchartCats1Level2 = ["X", "Y", "Z"];
export const barchartCats2 = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];

export const getBarData = (nestedBaseAxis: AxisName, baseAxis: AxisName, valueAxis: AxisName) => {
  const barData: Bars = [];
  barchartCats1Level1.forEach(c1 => {
    barchartCats1Level2.forEach(c2 => {
      const segLength = (Math.random() * 25 + 25) / palette.length;
      barData.push({
        baseAxis: nestedBaseAxis as any,
        base: [c1, c2],
        valueAxis: valueAxis as any,
        stack: palette.map((c, i) => {
          return {
            style: { color: c, opacity: 0.8 },
            range: [segLength * i, segLength * (i + 1)],
          };
        })
      })
    });
  });

  barchartCats2.forEach(c => {
    const segLength = (50 - Math.random() * 25) / palette.length;
    barData.push({
      baseAxis: baseAxis as any,
      base: [c],
      valueAxis: valueAxis as any,
      stack: palette.map((c, i) => {
          return {
            style: { color: c, opacity: 0.8 },
            range: [100 - segLength * i, 100 - segLength * (i + 1)],
          };
        })
    });
  });

  return barData;
};

export const getDoubleBarData = (nestedBaseAxis: AxisName, valueAxis: AxisName) => {
  const barData: Bars = [];
  barchartCats1Level1.forEach(c1 => {
    const smallerBarLengths = barchartCats1Level2.map(() => Math.random() * 30 + 3);
    const bigBarLength = smallerBarLengths.reduce((sum, x) => x + sum, 0);

    barData.push({
      baseAxis: nestedBaseAxis as any,
      base: [c1],
      valueAxis: valueAxis as any,
      stack: [{
        style: { color: palette.at(-2), opacity: 0.5 },
        range: [0, bigBarLength]
      }]
    });

    barchartCats1Level2.forEach((c2, i) => {
      barData.push({
        baseAxis: nestedBaseAxis as any,
        base: [c1, c2],
        valueAxis: valueAxis as any,
        stack: [{
          style: { color: palette[i], opacity: 0.75 },
          range: [0, smallerBarLengths[i]]
        }]
      })
    });
  });

  return barData;
};
