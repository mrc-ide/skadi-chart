<template>
  <main v-if="benchmarkPage">
    <h1>Matched trace stress benchmark</h1>
    <p>
      Shared deterministic data; 1000 × 500 pixels; linear scales; traces only.
      RDP epsilon 1 is compared first, then simplification disabled.
      Each mode has two warm-up pairs and six measured pairs, alternating which implementation runs first.
      Keep this tab visible and avoid other browser activity.
    </p>
    <label>
      Dataset
      <select v-model="benchmarkSize" :disabled="running">
        <option value="full">1000 traces × 1000 points</option>
        <option value="smoke">10 traces × 100 points (smoke test)</option>
      </select>
    </label>
    <button :disabled="running" @click="runBenchmark">{{ running ? "Running…" : "Run benchmark" }}</button>
    <p role="status">{{ status }}</p>
    <div id="trace-benchmark-chart" ref="benchmarkContainer"></div>
    <template v-if="result">
      <p>Generation (once): {{ result.generationMs.toFixed(1) }} ms. All table timings are medians.</p>
      <p>
        Configuration includes data registration, domain scanning, scales and SVG setup.
        Drawing includes coordinate conversion, RDP, path creation and SVG mounting.
        Frame wait is a double-requestAnimationFrame latency, not paint duration.
        Actual Chromium Paint events are available through the opt-in Playwright benchmark.
      </p>
      <table>
        <thead>
          <tr>
            <th>Implementation</th><th>RDP epsilon</th><th>Configuration (ms)</th>
            <th>Draw + mount (ms)</th><th>Frame wait (ms)</th>
            <th>Retained points</th><th>Path characters</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in summarizeBenchmark(result)" :key="`${row.implementation}-${row.epsilon}`">
            <td>{{ row.implementation }}</td><td>{{ row.epsilon ?? "off" }}</td>
            <td>{{ row.configurationMs.toFixed(1) }}</td><td>{{ row.drawAndMountMs.toFixed(1) }}</td>
            <td>{{ row.frameWaitMs.toFixed(1) }}</td><td>{{ row.retainedPoints }}</td>
            <td>{{ row.pathCharacters }}</td>
          </tr>
        </tbody>
      </table>
      <p>
        {{ hasMeaningfulGap(result)
          ? "A gap remains (>10% and >5 ms in median synchronous time). Repeat to confirm, then profile configuration and GC."
          : "No new-interface slowdown exceeds both 10% and 5 ms in median synchronous time." }}
      </p>
      <details>
        <summary>Raw results (JSON)</summary>
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </details>
    </template>
  </main>
  <template v-else>
    <a href="?traceBenchmark">Matched trace stress benchmark</a>
    <NewSkadiChart />
    <details style="margin-top: 4rem;">
      <summary>Legacy Skadi Chart</summary>
      <LegacySkadiChart />
    </details>
  </template>
</template>

<script setup lang="ts">
import { ref, shallowRef } from "vue";
import LegacySkadiChart from "./LegacySkadiChart.vue";
import NewSkadiChart from "./NewSkadiChart.vue";
import {
  defaultBenchmarkOptions, hasMeaningfulGap, runTraceBenchmark, summarizeBenchmark,
  type BenchmarkResult,
} from "./traceBenchmark";

const benchmarkPage = new URLSearchParams(location.search).has("traceBenchmark");
const benchmarkContainer = ref<HTMLDivElement | null>(null);
const benchmarkSize = ref("full");
const running = ref(false);
const status = ref("");
const result = shallowRef<BenchmarkResult>();

const runBenchmark = async () => {
  if (!benchmarkContainer.value || running.value) return;
  running.value = true;
  result.value = undefined;
  status.value = "Running warm-ups and alternating samples…";
  try {
    result.value = await runTraceBenchmark(benchmarkContainer.value, {
      ...defaultBenchmarkOptions,
      ...(benchmarkSize.value === "smoke" ? { lineCount: 10, pointCount: 100 } : {}),
    });
    status.value = "Benchmark complete.";
  } catch (error) {
    status.value = error instanceof Error ? error.message : String(error);
  } finally {
    running.value = false;
  }
};
</script>
