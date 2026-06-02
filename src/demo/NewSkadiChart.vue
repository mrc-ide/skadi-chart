<template>
  <h1>Axes layer</h1>
  <select v-model="chartTypes" multiple>
    <option v-for="option in chartTypeOptions" :key="option" :value="option">
      {{ option }}
    </option>
  </select>
  <div class="charts-container">
    <div v-if="chartTypes.includes('default')">
      <h2>Numerical axes (default)</h2>
      <div class="chart" ref="numericalAxes" id="numericalAxes"></div>
    </div>
    <div v-if="chartTypes.includes('categoricalXY')">
      <h2>X and Y categorical axes</h2>
      <div class="chart" ref="categoricalXYAxes" id="categoricalXYAxes"></div>
    </div>
    <div v-if="chartTypes.includes('categoricalX')">
      <h2>Categorical x-axis</h2>
      <div class="chart" ref="categoricalXAxis" id="categoricalXAxis"></div>
    </div>
    <div v-if="chartTypes.includes('categoricalY')">
      <h2>Categorical y-axis</h2>
      <div class="chart" ref="categoricalYAxis" id="categoricalYAxis"></div>
    </div>
  </div>
</template>

<style scoped>
.charts-container {
  --chart-gap: 4rem;
  display: flex;
  flex-wrap: wrap;
  gap: var(--chart-gap);
}

.chart {
  width: calc(50dvw - var(--chart-gap));
  height: 500px;
}
</style>

<script setup lang="ts">
import type { ChartType } from "@/types";
import { onMounted, ref, watch } from "vue";
import { Base as ChartNew } from "../Chart/base/Base";

const numericalAxes = ref<HTMLDivElement | null>(null);
const categoricalXYAxes = ref<HTMLDivElement | null>(null);
const categoricalXAxis = ref<HTMLDivElement | null>(null);
const categoricalYAxis = ref<HTMLDivElement | null>(null);

const chartTypeOptions: readonly ChartType[] = [
  "default",
  "categoricalXY",
  "categoricalX",
  "categoricalY",
];
const chartTypes = ref<ChartType[]>([...chartTypeOptions]);

const chartContainers: Record<ChartType, typeof numericalAxes> = {
  default: numericalAxes,
  categoricalXY: categoricalXYAxes,
  categoricalX: categoricalXAxis,
  categoricalY: categoricalYAxis,
};

const clearChart = (chartType: ChartType) => {
  chartContainers[chartType].value?.replaceChildren();
};

const renderChart = (chartType: ChartType) => {
  const container = chartContainers[chartType].value;

  if (!container) {
    return;
  }

  if (chartType === "default") {
    new ChartNew("default", container)
      .startData()
      .startConfig()
      .configureScales({
        x: { extents: { start: 0, end: 40 } },
        y: { extents: { start: -500, end: 500 } },
      })
      .startVisual()
      .addAxes()
      .startInteractive()
      .end();
    return;
  }

  if (chartType === "categoricalXY") {
    new ChartNew("categoricalXY", container)
      .startData()
      .startConfig()
      .configureCategories({
        x: ["A", "B", "C"],
        y: ["hey", "what"],
      })
      .configureScales({
        x: { extents: { start: -20, end: 20 } },
        y: { extents: { start: -500, end: 500 } },
      })
      .startVisual()
      .addAxes()
      .startInteractive()
      .end();
    return;
  }

  if (chartType === "categoricalX") {
    new ChartNew("categoricalX", container)
      .startData()
      .startConfig()
      .configureCategories({
        x: ["A", "B", "C"],
      })
      .configureScales({
        x: { extents: { start: 0, end: 40 } },
        y: { extents: { start: -500, end: 500 } },
      })
      .startVisual()
      .addAxes()
      .startInteractive()
      .end();
    return;
  }

  new ChartNew("categoricalY", container)
    .startData()
    .startConfig()
    .configureCategories({
      y: ["hey", "what"],
    })
    .configureScales({
      x: { extents: { start: 0, end: 40 } },
      y: { extents: { start: 0, end: 500 } },
    })
    .startVisual()
    .addAxes()
    .startInteractive()
    .end();
};

onMounted(() => {
  watch(chartTypes, (selectedChartTypes, oldChartTypes = []) => {
    chartTypeOptions.forEach((chartType) => {
      if (selectedChartTypes.includes(chartType) && !oldChartTypes.includes(chartType)) {
        renderChart(chartType);
      }

      if (!selectedChartTypes.includes(chartType) && oldChartTypes.includes(chartType)) {
        clearChart(chartType);
      }
    });
  }, {
    immediate: true,
    flush: "post", // Ensure v-if container refs update before we attempt to render charts
  });
});
</script>
