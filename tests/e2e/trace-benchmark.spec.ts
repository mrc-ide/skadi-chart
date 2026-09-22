import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { VisualLayer } from "@/Chart/visual/types";
import type { BenchmarkResult } from "../../src/demo/traceBenchmark";
import { hasMeaningfulGap, summarizeBenchmark } from "../../src/demo/traceBenchmark";

test.beforeEach(async ({ page }) => {
  // These trace-only checks do not need MathJax; a stalled CDN must not block navigation.
  await page.route("https://cdn.jsdelivr.net/**", route => route.abort());
});

const checkResults = (result: BenchmarkResult) => {
  expect(result.samples).toHaveLength(result.options.samplePairs * 4);
  expect(result.generationMs).toBeGreaterThanOrEqual(0);
  for (const epsilon of [1, null]) {
    const samples = result.samples.filter(s => s.epsilon === epsilon);
    for (let pair = 0; pair < result.options.samplePairs; pair++) {
      expect(samples.slice(pair * 2, pair * 2 + 2).map(s => s.implementation))
        .toEqual(pair % 2 === 0 ? ["legacy", "new"] : ["new", "legacy"]);
    }
    for (const sample of samples) {
      expect(sample.pathCount).toBe(result.options.lineCount);
      expect(sample.retainedPoints).toBe(samples[0].retainedPoints);
      expect(sample.pathCharacters).toBe(samples[0].pathCharacters);
      expect(sample.configurationMs).toBeGreaterThanOrEqual(0);
      expect(sample.drawAndMountMs).toBeGreaterThanOrEqual(0);
      expect(sample.frameWaitMs).toBeGreaterThanOrEqual(0);
      expect(sample.synchronousMs).toBeCloseTo(sample.configurationMs + sample.drawAndMountMs);
      const inputPoints = result.options.lineCount * result.options.pointCount;
      if (epsilon === null) {
        expect(sample.retainedPoints).toBe(inputPoints);
      } else {
        expect(sample.retainedPoints).toBeLessThan(inputPoints);
      }
    }
  }
};

test("matched benchmark isolates demos and reports comparable SVG workloads", async ({ page }) => {
  await page.goto("http://localhost:5173/?traceBenchmark");
  await expect(page.locator("#numericalAxes")).toHaveCount(0);
  await page.getByLabel("Dataset").selectOption("smoke");
  await page.getByRole("button", { name: "Run benchmark" }).click();
  await expect(page.getByRole("status")).toHaveText("Benchmark complete.");
  const result: BenchmarkResult = JSON.parse(await page.locator("pre").textContent() || "");
  checkResults(result);
  await expect(page.locator("#trace-benchmark-chart svg")).toHaveAttribute("viewBox", "0 0 1000 500");
  await expect(page.locator("#trace-benchmark-chart svg")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("original new-interface stress demo enables simplification", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await page.getByRole("button", { name: "Draw", exact: true }).first().click();
  const paths = page.locator("#chartStress").first().locator(`path[id^="${VisualLayer.Trace}-"]`);
  await expect(paths).toHaveCount(1000);
  const points = await paths.evaluateAll(elements => elements.reduce((sum, path) => {
    return sum + (path.getAttribute("d")?.match(/[ML]/g)?.length || 0);
  }, 0));
  expect(points).toBeGreaterThan(2000);
  expect(points).toBeLessThan(1_000_000);
});

type TraceEvent = {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
};

const stopTracing = async (session: CDPSession) => {
  const completed = new Promise<{ stream?: string }>(resolve => {
    session.once("Tracing.tracingComplete", resolve);
  });
  await session.send("Tracing.end");
  const { stream } = await completed;
  if (!stream) throw new Error("Chromium did not return a timeline stream.");
  let json = "";
  try {
    while (true) {
      const chunk = await session.send("IO.read", { handle: stream });
      json += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString() : chunk.data;
      if (chunk.eof) break;
    }
  } finally {
    await session.send("IO.close", { handle: stream });
  }
  return json;
};

const runFullBenchmark = (page: Page) => page.evaluate(async () => {
  const modulePath = "/traceBenchmark.ts";
  const { runTraceBenchmark } = await import(modulePath);
  performance.clearMarks();
  return runTraceBenchmark(document.querySelector("#trace-benchmark-chart"));
}) as Promise<BenchmarkResult>;

// Opt-in: timings are diagnostic, never CI speed assertions.
// TRACE_BENCHMARK=1 npm run test:e2e -- tests/e2e/trace-benchmark.spec.ts --project=chromium --workers=1
test("full stress benchmark with browser paint measurements", async ({ page, browserName }, testInfo) => {
  test.skip(process.env.TRACE_BENCHMARK !== "1" || browserName !== "chromium");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:5173/?traceBenchmark");
  const session = await page.context().newCDPSession(page);

  // Establish the gap without CPU profiling or timeline tracing overhead first.
  const baseline = await runFullBenchmark(page);
  checkResults(baseline);
  await testInfo.attach("baseline.json", {
    body: JSON.stringify({ ...baseline, medians: summarizeBenchmark(baseline) }, null, 2),
    contentType: "application/json",
  });

  const profile = hasMeaningfulGap(baseline);
  await session.send("Tracing.start", {
    categories: profile
      ? "devtools.timeline,blink.user_timing,v8,disabled-by-default-v8.gc"
      : "devtools.timeline,blink.user_timing",
    transferMode: "ReturnAsStream",
  });
  if (profile) {
    await session.send("Profiler.enable");
    await session.send("Profiler.start");
  }
  let result: BenchmarkResult | undefined;
  try {
    result = await runFullBenchmark(page);
  } finally {
    if (profile) {
      const { profile: cpuProfile } = await session.send("Profiler.stop");
      await testInfo.attach("remaining-gap.cpuprofile", {
        body: JSON.stringify(cpuProfile),
        contentType: "application/json",
      });
    }
    const trace = await stopTracing(session);
    await testInfo.attach("browser-timeline.json", { body: trace, contentType: "application/json" });
    await session.detach();

    if (result) {
      const events: TraceEvent[] = JSON.parse(trace).traceEvents;
      const samples = result.samples.map(sample => {
        const mounted = events.find(e => e.name === `${sample.id}:mounted`)!;
        const settled = events.find(e => e.name === `${sample.id}:settled`)!;
        expect(mounted).toBeDefined();
        expect(settled).toBeDefined();
        const paints = events.filter(e => e.name === "Paint" && e.ph === "X"
          && e.pid === mounted.pid && e.tid === mounted.tid
          && e.ts >= mounted.ts && e.ts < settled.ts);
        return {
          ...sample,
          // Main-thread Paint work only; not compositor/GPU raster time or frame latency.
          mainThreadPaintMs: paints.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000,
          paintEvents: paints.length,
        };
      });
      expect(samples.some(s => s.paintEvents > 0)).toBe(true);
      await testInfo.attach("paint-results.json", {
        body: JSON.stringify({ ...result, profiled: profile, samples }, null, 2),
        contentType: "application/json",
      });
    }
  }
  expect(result).toBeDefined();
  checkResults(result!);
});
