<template>
  <h1>Axes layer</h1>
  <div style="display: flex; flex-wrap: wrap; gap: 4rem;">
    <div>
      <h2>Numerical axes</h2>
      <div class="chart" ref="numericalAxes" id="numericalAxes"></div>
    </div>
    <div>
      <h2>X and Y categorical axes</h2>
      <div class="chart" ref="categoricalXYAxes" id="categoricalXYAxes"></div>
    </div>
    <div>
      <h2>Categorical x-axis</h2>
      <div class="chart" ref="categoricalXAxis" id="categoricalXAxis"></div>
    </div>
    <div>
      <h2>Categorical y-axis</h2>
      <div class="chart" ref="categoricalYAxis" id="categoricalYAxis"></div>
    </div>
  </div>
</template>

<style>
.chart {
  width: 1000px;
  height: 500px;
}
</style>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Base as ChartNew } from "../Chart/base/Base";


const numericalAxes = ref<HTMLDivElement | null>(null);
const categoricalXYAxes = ref<HTMLDivElement | null>(null);
const categoricalXAxis = ref<HTMLDivElement | null>(null);
const categoricalYAxis = ref<HTMLDivElement | null>(null);

onMounted(async () => {
  new ChartNew("default", numericalAxes.value!)
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

  new ChartNew("categoricalXY", categoricalXYAxes.value!)
    .startData()
    .startConfig()
    .configureCategories({
      x: ["A", "B", "C"],
      y: ["hey", "what"]
    })
    .configureScales({
      x: { extents: { start: 0, end: 40 } },
      y: { extents: { start: -500, end: 500 } },
    })
    .startVisual()
    .addAxes()
    .startInteractive()
    .end();

  new ChartNew("categoricalX", categoricalXAxis.value!)
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

  new ChartNew("categoricalY", categoricalYAxis.value!)
    .startData()
    .startConfig()
    .configureCategories({
      y: ["hey", "what"]
    })
    .configureScales({
      x: { extents: { start: 0, end: 40 } },
      y: { extents: { start: 0, end: 500 } },
    })
    .startVisual()
    .addAxes()
    .startInteractive()
    .end();
});
</script>
