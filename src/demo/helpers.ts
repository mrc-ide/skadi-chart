
type GenerateWaveLinesOptions = {
  lineCount: number;
  pointCount: number;
  xRange: { start: number; end: number };
  yRange: { start: number; end: number };
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
  xRange,
  yRange,
  cycles = 2,
  amplitude = 0.25,
  phaseStep = 2 * Math.PI / lineCount,
  randomizeAmplitude,
  opacity = 0.7,
  strokeWidth = 1.5,
}: GenerateWaveLinesOptions) => {
  if (pointCount < 2) {
    throw new Error("pointCount must be >= 2");
  }
  if (xRange.start >= xRange.end || yRange.start >= yRange.end) {
    throw new Error("range min must be < max");
  }

  const palette = ["#1f77b4", "#d62728", "#2ca02c", "#ff7f0e", "#9467bd"];
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
    const rawMin = Math.min(...raw);
    const rawMax = Math.max(...raw);
    const rawSpan = rawMax - rawMin || 1;

    const points = raw.map((rawY, i) => {
      const t = i / (pointCount - 1);

      const x = xRange.start + t * (xRange.end - xRange.start); // full x range
      const y01 = (rawY - rawMin) / rawSpan;
      const y = yRange.start + y01 * (yRange.end - yRange.start); // full y range

      return { x, y };
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
