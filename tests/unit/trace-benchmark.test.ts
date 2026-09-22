import {
  hasMeaningfulGap, median, summarizeBenchmark,
  type BenchmarkResult, type BenchmarkSample,
} from "@/demo/traceBenchmark";

const makeResult = (legacyMs: number, newMs: number): BenchmarkResult => ({
  options: { lineCount: 1, pointCount: 100, warmupPairs: 2, samplePairs: 2 },
  generationMs: 1,
  userAgent: "test",
  samples: [1, null].flatMap(epsilon => [0, 1].flatMap(pair =>
    (["legacy", "new"] as const).map(implementation => ({
      id: `${epsilon}:${pair}:${implementation}`,
      implementation, epsilon,
      configurationMs: 1,
      drawAndMountMs: (implementation === "legacy" ? legacyMs : newMs) - 1,
      synchronousMs: implementation === "legacy" ? legacyMs : newMs,
      frameWaitMs: 16,
      pathCount: 1,
      retainedPoints: epsilon === null ? 100 : 10,
      pathCharacters: epsilon === null ? 1000 : 100,
    } satisfies BenchmarkSample)))),
});

describe("trace benchmark summaries", () => {
  test("calculates medians without changing the samples", () => {
    const values = [50, 1, 3, 2];
    expect(median(values)).toBe(2.5);
    expect(values).toEqual([50, 1, 3, 2]);
    expect(median([100, 2, 1])).toBe(2);
  });

  test("keeps implementations and simplification settings separate", () => {
    const summaries = summarizeBenchmark(makeResult(20, 40));
    expect(summaries).toHaveLength(4);
    expect(summaries.map(s => s.synchronousMs)).toEqual([20, 40, 20, 40]);
    expect(summaries.map(s => s.retainedPoints)).toEqual([10, 10, 100, 100]);
  });

  test("only recommends profiling when both absolute and relative thresholds are exceeded", () => {
    expect(hasMeaningfulGap(makeResult(20, 24))).toBe(false);
    expect(hasMeaningfulGap(makeResult(100, 109))).toBe(false);
    expect(hasMeaningfulGap(makeResult(20, 30))).toBe(true);
    expect(hasMeaningfulGap(makeResult(30, 20))).toBe(false);
  });
});
