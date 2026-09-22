import { Chart } from "@/Chart";
import { Base } from "@/Chart/base/Base";
import { generateWaveLines } from "./helpers";

type Implementation = "legacy" | "new";

export type BenchmarkOptions = {
  lineCount: number;
  pointCount: number;
  warmupPairs: number;
  samplePairs: number;
};

export const defaultBenchmarkOptions: BenchmarkOptions = {
  lineCount: 1000,
  pointCount: 1000,
  warmupPairs: 2,
  samplePairs: 6,
};

export type BenchmarkSample = {
  id: string;
  implementation: Implementation;
  epsilon: number | null;
  configurationMs: number;
  drawAndMountMs: number;
  synchronousMs: number;
  frameWaitMs: number;
  pathCount: number;
  retainedPoints: number;
  pathCharacters: number;
};

export type BenchmarkResult = {
  options: BenchmarkOptions;
  generationMs: number;
  userAgent: string;
  samples: BenchmarkSample[];
};

const extents = {
  x: { start: -20, end: 20 },
  y: { start: -500, end: 500 },
};

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const summarizeBenchmark = (result: BenchmarkResult) =>
  [1, null].flatMap(epsilon => (["legacy", "new"] as const).map(implementation => {
    const samples = result.samples.filter(s => s.epsilon === epsilon && s.implementation === implementation);
    return {
      implementation,
      epsilon,
      configurationMs: median(samples.map(s => s.configurationMs)),
      drawAndMountMs: median(samples.map(s => s.drawAndMountMs)),
      synchronousMs: median(samples.map(s => s.synchronousMs)),
      frameWaitMs: median(samples.map(s => s.frameWaitMs)),
      retainedPoints: median(samples.map(s => s.retainedPoints)),
      pathCharacters: median(samples.map(s => s.pathCharacters)),
    };
  }));

export const hasMeaningfulGap = (result: BenchmarkResult) => {
  const summaries = summarizeBenchmark(result);
  return [1, null].some(epsilon => {
    const legacy = summaries.find(s => s.epsilon === epsilon && s.implementation === "legacy")!;
    const modern = summaries.find(s => s.epsilon === epsilon && s.implementation === "new")!;
    return modern.synchronousMs - legacy.synchronousMs > Math.max(5, legacy.synchronousMs * 0.1);
  });
};

export const runTraceBenchmark = async (
  container: HTMLDivElement,
  options: BenchmarkOptions = defaultBenchmarkOptions,
): Promise<BenchmarkResult> => {
  for (const [key, value] of Object.entries(options)) {
    const minimum = key === "warmupPairs" ? 0 : key === "pointCount" ? 2 : 1;
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`${key} must be an integer >= ${minimum}`);
    }
  }
  if (!container.isConnected || document.visibilityState !== "visible") {
    throw new Error("Run the benchmark in a visible tab with an attached container.");
  }
  container.style.width = "1000px";
  container.style.height = "500px";
  container.scrollIntoView();
  await nextFrame();
  const bounds = container.getBoundingClientRect();
  if (bounds.width !== 1000 || bounds.height !== 500) {
    throw new Error("The benchmark requires a visible 1000 × 500 container.");
  }

  const generationStart = performance.now();
  const lines = generateWaveLines({
    lineCount: options.lineCount,
    pointCount: options.pointCount,
    xRange: extents.x,
    yRange: extents.y,
    cycles: 5,
    amplitude: 0.2,
    randomizeAmplitude: false,
    opacity: 0.1,
    strokeWidth: 1,
  });
  const generationMs = performance.now() - generationStart;
  const samples: BenchmarkSample[] = [];

  // Both adapters use only traces, the same point objects, linear domains and margins.
  // No point is clipped, so the number of M/L commands is the retained point count.
  for (const epsilon of [1, null]) {
    for (let pair = -options.warmupPairs; pair < options.samplePairs; pair++) {
      const order: Implementation[] = pair % 2 === 0 ? ["legacy", "new"] : ["new", "legacy"];
      for (const implementation of order) {
        container.replaceChildren();
        await nextFrame();
        await nextFrame();
        if (document.visibilityState !== "visible") {
          throw new Error("Keep the benchmark tab visible throughout the run.");
        }
        const id = `trace-benchmark:${epsilon ?? "off"}:${pair}:${implementation}`;
        const started = performance.mark(`${id}:start`).startTime;
        let configured: number;
        if (implementation === "legacy") {
          const chart = new Chart().addTraces(lines, { RDPEpsilon: epsilon });
          const traces = chart.optionalLayers[0];
          const draw = traces.draw;
          traces.draw = (...args) => {
            configured = performance.mark(`${id}:configured`).startTime;
            draw(...args);
          };
          chart.appendTo(container, extents);
        } else {
          const chart = new Base("default", container)
            .startData()
            .registerLines(lines)
            .startConfig()
            .configureScales({ x: { extents: extents.x }, y: { extents: extents.y } })
            .startVisual()
            .addTraces({ RDPEpsilon: epsilon })
            .startInteractive();
          configured = performance.mark(`${id}:configured`).startTime;
          chart.end();
        }
        const mounted = performance.mark(`${id}:mounted`).startTime;
        // A double rAF allows a paint opportunity, but is NOT a paint-duration timer.
        // The Chromium benchmark test measures actual Paint events separately via CDP.
        await nextFrame();
        await nextFrame();
        const settled = performance.mark(`${id}:settled`).startTime;
        if (document.visibilityState !== "visible") {
          throw new Error("Keep the benchmark tab visible throughout the run.");
        }
        if (pair < 0) continue;

        let pathCount = 0;
        let retainedPoints = 0;
        let pathCharacters = 0;
        for (const path of Array.from(container.querySelectorAll("path"))) {
          const d = path.getAttribute("d") || "";
          pathCount++;
          pathCharacters += d.length;
          for (let i = 0; i < d.length; i++) {
            if (d[i] === "M" || d[i] === "L") retainedPoints++;
          }
        }
        samples.push({
          id, implementation, epsilon,
          configurationMs: configured! - started,
          drawAndMountMs: mounted - configured!,
          synchronousMs: mounted - started,
          frameWaitMs: settled - mounted,
          pathCount, retainedPoints, pathCharacters,
        });
      }
    }
  }
  return { options: { ...options }, generationMs, userAgent: navigator.userAgent, samples };
};
