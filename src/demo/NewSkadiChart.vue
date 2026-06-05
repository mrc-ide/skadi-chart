<template>
  <div class="chart-type-container">
    <label>chartTypes:</label>
    <div style="width: 500px">
      <VueSelect
        v-model="selectedChartTypes"
        :options="chartTypeOptions"
        is-multi
        placeholder="Select chart types"
      />
    </div>
  </div>
  <h1>Axes layer</h1>
  <div class="charts-container">
    <div v-if="selectedChartTypes.includes('default')">
      <h2>Numerical axes (default)</h2>
      <div class="chart" ref="numericalAxes" id="numericalAxes"></div>
    </div>
    <div v-if="selectedChartTypes.includes('categoricalXY')">
      <h2>X and Y categorical axes</h2>
      <div class="chart" ref="categoricalXYAxes" id="categoricalXYAxes"></div>
    </div>
    <div v-if="selectedChartTypes.includes('categoricalX')">
      <h2>Categorical x-axis</h2>
      <div class="chart" ref="categoricalXAxis" id="categoricalXAxis"></div>
    </div>
    <div v-if="selectedChartTypes.includes('categoricalY')">
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

.chart-type-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>

<script setup lang="ts">
import type { ChartType } from "@/types";
import type { Option } from "vue3-select-component";
import VueSelect from "vue3-select-component";
import { onMounted, ref, watch } from "vue";
import { Base as ChartNew } from "../Chart/base/Base";

const numericalAxes = ref<HTMLDivElement | null>(null);
const categoricalXYAxes = ref<HTMLDivElement | null>(null);
const categoricalXAxis = ref<HTMLDivElement | null>(null);
const categoricalYAxis = ref<HTMLDivElement | null>(null);

const chartTypes: readonly ChartType[] = [
  "default",
  "categoricalXY",
  "categoricalX",
  "categoricalY",
];

const chartTypeOptions: Option<ChartType>[] = chartTypes.map((chartType) => ({
  label: chartType,
  value: chartType,
}));
const selectedChartTypes = ref<ChartType[]>([...chartTypes]);

const chartContainers: Record<ChartType, typeof numericalAxes> = {
  default: numericalAxes,
  categoricalXY: categoricalXYAxes,
  categoricalX: categoricalXAxis,
  categoricalY: categoricalYAxis,
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
      .configureAxes({
        x: { label: { text: "Time" } },
        y: { label: { text: "Value" } },
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

  if (chartType === "categoricalXY") {
    new ChartNew("categoricalXY", container)
      .startData()
      .startConfig()
      .configureAxes({
        x: { label: { text: "X Category", padding: 70 } },
        y: { label: { text: "Y Category", padding: 50 } },
      })
      .configureCategories({
        x: ["A", "B", "C"],
        y: ["Category A", "Category B"],
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
      .configureAxes({
        x: { label: { text: "X Category", padding: 70 } },
        y: { label: { text: "Value" } },
      })
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
    .configureAxes({
      x: { label: { text: "Time" } },
      y: { label: { text: "Y Category" } },
    })
    .configureCategories({
      y: ["Category A", "Category B"],
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

watch(selectedChartTypes, (newChartTypes) => {
  newChartTypes.forEach(renderChart);
}, {
  flush: "post", // Ensure v-if container refs update before we attempt to render charts
});

onMounted(() => {
  selectedChartTypes.value.forEach(renderChart);
});
</script>
