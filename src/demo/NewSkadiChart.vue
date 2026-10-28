<template>
  <div class="chart-type-container">
    <label>Axes:</label>
    <div style="width: 500px">
      <VueSelect
        v-model="selectedChartTypes"
        :options="chartTypeOptions"
        is-multi
        placeholder="Select chart types"
      />
    </div>
    <!-- Toggle log scale for each axis -->
    <div v-for="axis in ['x', 'y']" :key="axis">
      <label>
        <input type="checkbox" v-model="logScale[axis]" />
        Log scale {{ axis.toUpperCase() }}-axis
      </label>
    </div>
  </div>
  <div class="charts-container">
    <div v-if="selectedChartTypes.includes(ChartType.Numerical)">
      <h2>Numerical axes (default)</h2>
      <div class="chart" ref="numericalChart" id="numericalChart"></div>
    </div>
    <div v-if="selectedChartTypes.includes(ChartType.NumericalDoubled)">
      <h2>4 numerical axes</h2>
      <div class="chart" ref="numericalDoubledChart" id="numericalDoubledChart"></div>
    </div>
    <div v-if="selectedChartTypes.includes(ChartType.CategoricalXY)">
      <h2>X and Y categorical axes</h2>
      <div class="chart" ref="categoricalXYChart" id="categoricalXYChart"></div>
    </div>
    <div v-if="selectedChartTypes.includes(ChartType.CategoricalX)">
      <h2>Categorical x-axis</h2>
      <div class="chart" ref="categoricalXChart" id="categoricalXChart"></div>
    </div>
    <div v-if="selectedChartTypes.includes(ChartType.CategoricalY)">
      <h2>Categorical y-axis</h2>
      <div class="chart" ref="categoricalYChart" id="categoricalYChart"></div>
    </div>
    <div v-if="selectedChartTypes.includes(ChartType.CategoricalLine)">
      <h2>Categorical x-axis, two numerical y-axes</h2>
      <div class="chart" ref="categoricalLineChart" id="categoricalLineChart"></div>
    </div>
  </div>
  <h1 style="margin-top: 100px">
    With MathJax (experimental)
  </h1>
  <div class="chart" ref="mathJaxChart" id="mathJaxChart"></div>
  <h1>Stress test: 10 traces of 500,000 points</h1>
  <button @click="drawStressChart">Draw</button>
  <div class="chart" ref="stressTestChart" id="stressTestChart"></div>
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
import { generateWaveLines } from "@/demo/helpers";
import type { Option } from "vue3-select-component";
import VueSelect from "vue3-select-component";
import { onMounted, ref, watch } from "vue";
import { Axes as ChartNew } from "../Chart/axes/Axes";

const numericalChart = ref<HTMLDivElement | null>(null);
const numericalDoubledChart = ref<HTMLDivElement | null>(null);
const categoricalXYChart = ref<HTMLDivElement | null>(null);
const categoricalXChart = ref<HTMLDivElement | null>(null);
const categoricalYChart = ref<HTMLDivElement | null>(null);
const categoricalLineChart = ref<HTMLDivElement | null>(null);

const mathJaxChart = ref<HTMLDivElement | null>(null);
const stressTestChart = ref<HTMLDivElement | null>(null);

const logScale = ref({ x: false, y: false });

enum ChartType {
  Numerical = "numerical",
  NumericalDoubled = "numericalDoubled",
  CategoricalX = "categoricalX",
  CategoricalY = "categoricalY",
  CategoricalXY = "categoricalXY",
  CategoricalLine = "categoricalLine",
}

const chartTypes: Record<ChartType, string> = {
  [ChartType.Numerical]: "2 numerical axes", // Both x and y are numerical
  [ChartType.NumericalDoubled]: "4 numerical axes",
  [ChartType.CategoricalX]: "Categorical x-axis", // 1 cat (w/ nested num), 1 num
  [ChartType.CategoricalY]: "Categorical y-axis", // 1 num, 1 cat (w/ nested num)
  [ChartType.CategoricalXY]: "X and Y categorical axes", // 2 cats (each w/ nested num)
  [ChartType.CategoricalLine]: "Categorical x-axis, two numerical y-axes", // 1 cat (w/ nested num), 2 nums. For the bar chart + categorical line type of case.
};

const selectedChartTypes = ref<ChartType[]>(Object.keys(chartTypes) as ChartType[]);

const chartTypeOptions: Option<ChartType>[] = (Object.entries(chartTypes) as [ChartType, string][])
  .map(([value, label]) => ({ label, value }));

const chartContainers: Record<ChartType, typeof numericalChart> = {
  [ChartType.Numerical]: numericalChart,
  [ChartType.NumericalDoubled]: numericalDoubledChart,
  [ChartType.CategoricalX]: categoricalXChart,
  [ChartType.CategoricalY]: categoricalYChart,
  [ChartType.CategoricalXY]: categoricalXYChart,
  [ChartType.CategoricalLine]: categoricalLineChart,
};

const xCategories = ["A", "B", "C"];
const yCategories = ["Category A", "Category B"];

const renderMathJaxChart = () => {
  // new ChartNew("catNumXNumY", container)
    // .startData()
    // .registerLines(lines)
    // .startConfig()
    // .configureScales({
    //   x: { extents: extents.x, log: logScale.value.x },
    //   y: { extents: extents.y, log: logScale.value.y },
    // })
    // .configureTicks({
    //   x: { numerical: { formatter: (num) => `$${num}^{1}$`, enableMathJax: true } },
    //   y: { numerical: { specifier: ".1f", padding: 2, size: 5, count: 20 } },
    // })
    // .startVisual()
    // .addAxes()
    // .addTraces()
    // .startInteractive()
    // .end();
};

const renderChart = (chartType: ChartType) => {
  const container = chartContainers[chartType].value;

  if (!container) {
    return;
  }

  const extents = { x: { lower: -10, upper: 10 }, y: { lower: -250, upper: 250 } };

  const lineProps = {
    lineCount: xCategories.length * yCategories.length,
    pointCount: 200,
    // Include negative values in range to exercise the filtering of points when y-axis has log scale.
    xRange: extents.x,
    yRange: extents.y,
    cycles: 5,
    amplitude: 0.1,
  };

  const lines = generateWaveLines(lineProps);

  // TODO traces should filter lines that are for it?
  // need an interface for this??

  switch (chartType) {
  case ChartType.Numerical:
    // TODO: the interface of xBottom/yLeft is mapped to an interface of x:start, y:start.
    // Not that nice for user.
    ChartNew.start()
      .xBottom().numerical()
      .yLeft().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(lines)
      .startConfig()
      .configureAxes({
        x: { start: [{ label: { text: "Time", translate: 20 } }] },
        y: { start: [{ label: { text: "Value", translate: 20 } }] },
      })
      .configureDomain({
        x: { start: [{ domain: [extents.x.lower, extents.x.upper] }] },
        y: { start: [{ domain: [extents.y.lower, extents.y.upper] }] }
      })
      .configureTicks({
        x: { start: [{ tick: { size: 10, translate: 10, count: 4 } }] },
        y: { start: [{ tick: { size: 10, translate: 10 } }] }
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end()
    break;
  case ChartType.NumericalDoubled:
    // Use 4 mostly-straight lines so we can clearly see that they are being drawn on
    // each of the 4 permutations of x/y and start/end axes.
    const straightLines = generateWaveLines({ ...lineProps, amplitude: 0.01, lineCount: 4 });

    straightLines.forEach((l, i) => {
      l.axisName = [
        undefined,
        { x: "xBottom", y: "yRight" } as const,
        { x: "xTop", y: "yLeft" } as const,
        { x: "xTop", y: "yRight" } as const,
      ][i % 4];
    });

    ChartNew.start()
      .xBottom().numerical()
      .xTop().numerical()
      .yLeft().numerical()
      .yRight().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(straightLines)
      .startConfig()
      .configureAxes({
        x: {
          start: [{ label: { text: "Time", translate: 20 } }],
          end: [{ label: { text: "Space", translate: 20 } }],
        },
        y: {
          start: [{ label: { text: "Value", translate: 20 } }],
          end: [{ label: { text: "Amount", translate: 20 } }],
        },
      })
      .configureDomain({
        x: {
          start: [{ domain: [extents.x.lower, extents.x.upper] }],
          end: [{ domain: [-2, 1] }] // Unequal to ensure origin line does not overlap
        },
        y: {
          start: [{ domain: [extents.y.lower, extents.y.upper] }],
          end: [{ domain: [-200, 100] }] // Unequal to ensure origin line does not overlap
        },
      })
      .configureTicks({
        x: {
          start: [{ tick: { size: 10, translate: 10 } }],
          end: [{ tick: { size: 10, translate: 10 } }],
        },
        y: {
          start: [{ tick: { size: 10, translate: 10 } }],
          end: [{ tick: { size: 10, translate: 10 } }],
        }
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end()
    break;
  case ChartType.CategoricalXY:
    lines.forEach((l, i) => {
      l.points = l.points.map((p) => ({
        x: [xCategories[i % xCategories.length], p.x[0]],
        y: [yCategories[i % yCategories.length], p.y[0]]
      }));
    });

    ChartNew.start()
      .xBottom().categorical().numerical()
      .yLeft().categorical().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(lines)
      .startConfig()
      .configureAxes({
        x: { start: [
          { label: { text: "X category", translate: 7 }, innerPadding: 0.2 },
          { label: { text: "X numerical label", translate: 20 } },
        ] },
        y: { start: [
          { label: { text: "Y category", translate: 25 }, innerPadding: 0.25 },
          { label: { text: "Y numerical label", translate: 5 } }
        ] },
      })
      .configureDomain({
        x: { start: [{ domain: xCategories }, { domain: [extents.x.lower, extents.x.upper] }] },
        y: { start: [{ domain: yCategories }, { domain: [extents.y.lower, extents.y.upper] }] }
      })
      .configureTicks({
        x: { start: [
          { tick: { formatter: (v) => v.toLowerCase(), translate: 15 }, },
          { tick: { count: 3 } }
        ] },
        y: { start: [
          { tick: { formatter: (v) => v.toUpperCase(), translate: 40 } }, {}
        ] },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    break;
  case ChartType.CategoricalX:
    lines.forEach((l, i) => {
      l.points = l.points.map((p) => ({
        ...p,
        x: [xCategories[i % xCategories.length], p.x[0]],
      }));
    });

    ChartNew.start()
      .xBottom().categorical().numerical()
      .yLeft().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(lines)
      .startConfig()
      .configureAxes({
        x: { start: [
          { label: { text: "X category", translate: 7 }, innerPadding: 0.2 },
          { label: { text: "X numerical label", translate: 20 } },
        ] },
        y: { start: [
          { label: { text: "Y numerical label", translate: 5 } }
        ] },
      })
      .configureDomain({
        x: { start: [{ domain: xCategories }, { domain: [extents.x.lower, extents.x.upper] }] },
        y: { start: [{ domain: [extents.y.lower, extents.y.upper] }] }
      })
      .configureTicks({
        x: { start: [
          { tick: { formatter: (v) => v.toLowerCase(), translate: 15 } },
          { tick: { count: 3 } }
        ] }
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    break;
  case ChartType.CategoricalY:
    lines.forEach((l, i) => {
      l.points = l.points.map((p) => ({
        ...p,
        y: [yCategories[i % yCategories.length], p.y[0]],
      }));
    });

    ChartNew.start()
      .xBottom().numerical()
      .yLeft().categorical().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(lines)
      .startConfig()
      .configureAxes({
        x: { start: [
          { label: { text: "X numerical label", translate: 20 } },
        ] },
        y: { start: [
          { label: { text: "Y category", translate: 25 }, innerPadding: 0.25 },
          { label: { text: "Y numerical label", translate: 5 } }
        ] },
      })
      .configureDomain({
        x: { start: [{ domain: [extents.x.lower, extents.x.upper] }] },
        y: { start: [{ domain: yCategories }, { domain: [extents.y.lower, extents.y.upper] }] }
      })
      .configureTicks({
        x: { start: [
          { tick: { count: 3 } }
        ] },
        y: { start: [
          { tick: { formatter: (v) => v.toUpperCase(), translate: 40 } }, {}
        ] },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    break;
  case ChartType.CategoricalLine:
    const numericalLines = lines.map((l, i) => {
      l.points = l.points.map((p) => ({
        ...p,
        x: [xCategories[i % xCategories.length], p.x[0]],
      }));
      l.axisName = [
        undefined,
        { x: "xBottom", y: "yRight" } as const,
      ][i % 2];
      return l;
    });

    const yRightDomain = { min: -1, max: 1 };
    const categoricalLine = {
      points: xCategories.map((x) => ({
        x: [x],
        y: [Math.random() * (yRightDomain.max - yRightDomain.min) + yRightDomain.min],
      })),
      style: {
        strokeColor: "black",
        opacity: 1,
        strokeWidth: 4,
      },
      axisName: { x: "xBottom", y: "yRight" } as const,
    };


    ChartNew.start()
      .xBottom().categorical().numerical()
      .yLeft().numerical()
      .yRight().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines([...numericalLines, categoricalLine])
      .startConfig()
      .configureAxes({
        x: { start: [
          { label: { text: "X category", translate: 20 }, innerPadding: 0.2 },
          { label: { text: "X numerical label", translate: 40 } }
        ]},
        y: {
          start: [{ label: { text: "Y numerical label", translate: 5 } }],
          end: [{ label: { text: "Y numerical label", translate: 5 } }]
        }
      })
      .configureDomain({
        x: { start: [{ domain: xCategories }, { domain: [extents.x.lower, extents.x.upper] }] },
        y: { start: [{ domain: [extents.y.lower, extents.y.upper] }], end: [{ domain: [yRightDomain.min, yRightDomain.max] }] }
      })
      .configureTicks({
        x: { start: [{ tick: { size: 0, translate: 25 } }, { tick: { count: 2, translate: 4 } }] },
        y: { start: [{ tick: { size: 0 } }], end: [{ tick: { size: 0 } }] },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    break;
  }
};

const drawStressChart = () => {
  const container = stressTestChart.value;
  if (!container) {
    return;
  }
  const extents = { x: { lower: -10, upper: 10 }, y: { lower: -250, upper: 250 } };

  const lines = generateWaveLines({
    lineCount: 10,
    pointCount: 500000,
    xRange: extents.x,
    yRange: extents.y,
    cycles: 5,
    amplitude: 0.2,
    opacity: 0.9,
  });

  ChartNew.start()
    .xBottom().numerical()
    .yLeft().numerical()
    .startHtml()
    .addElement(container)
    .startData()
    .registerLines(lines)
    .startConfig()
    .configureAxes({
      x: { start: [{ label: { text: "Time" } }] },
      y: { start: [{ label: { text: "Value" } }] },
    })
    .configureLines({ RDPEpsilon: 1 })
    .configureDomain({
      x: { start: [{ domain: [extents.x.lower, extents.x.upper] }] },
      y: { start: [{ domain: [extents.y.lower, extents.y.upper] }] }
    })
    .startVisual()
    .addAxes()
    .addTraces()
    .startInteractive()
    .end();
};

watch(selectedChartTypes, (newChartTypes) => {
  newChartTypes.forEach(renderChart);
}, {
  flush: "post", // Ensure v-if container refs update before we attempt to render charts
});

watch(logScale, () => {
  // renderMathJaxChart();
  selectedChartTypes.value.forEach(renderChart);
}, { deep: true });

onMounted(() => {
  selectedChartTypes.value.forEach(renderChart);

  // renderMathJaxChart();
});
</script>
