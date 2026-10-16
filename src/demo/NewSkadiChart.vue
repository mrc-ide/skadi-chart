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
    <!-- Toggle log scale for each axis -->
    <div v-for="axis in ['x', 'y']" :key="axis">
      <label>
        <input type="checkbox" v-model="logScale[axis]" />
        Log scale {{ axis.toUpperCase() }}-axis
      </label>
    </div>
  </div>
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
  <h1 style="margin-top: 100px">
    With MathJax (experimental)
  </h1>
  <div class="chart" ref="chartMathJax" id="chartMathJax"></div>
  <h1>Stress test: 1000 traces</h1>
  <button @click="drawStressChart">Draw</button>
  <div class="chart" ref="chartStress" id="chartStress"></div>
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
import type { ChartType } from "@/types";
import type { Option } from "vue3-select-component";
import VueSelect from "vue3-select-component";
import { onMounted, ref, watch } from "vue";
import { Axes as ChartNew } from "../Chart/axes/Axes";
import { Lines } from "@/Chart/data/types";

const numericalAxes = ref<HTMLDivElement | null>(null);
const categoricalXYAxes = ref<HTMLDivElement | null>(null);
const categoricalXAxis = ref<HTMLDivElement | null>(null);
const categoricalYAxis = ref<HTMLDivElement | null>(null);
const chartMathJax = ref<HTMLDivElement | null>(null);
const chartStress = ref<HTMLDivElement | null>(null);

const logScale = ref({ x: false, y: false });

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

const xCategories = ["A", "B", "C"];
const yCategories = ["Category A", "Category B"];

const renderMathJaxChart = () => {
  const container = chartMathJax.value;
  if (!container) {
    return;
  }
  const extents = {
    x: { start: logScale.value.x ? 1 : 0, end: 40 },
    y: { start: logScale.value.y ? 1 : -500, end: 500 },
  };
  const lines = generateWaveLines({
    lineCount: 2,
    pointCount: 300,
    xRange: extents.x,
    yRange: extents.y,
    cycles: 5,
    amplitude: 0.2,
  });
  new ChartNew("catNumXNumY", container)
    .startData()
    // .registerLines(lines)
    .startConfig()
  console.log("DOne")
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
}

const renderChart = (chartType: ChartType) => {
  const container = chartContainers[chartType].value;

  if (!container) {
    return;
  }

  const extents = {
    x: { start: logScale.value.x ? 1 : chartType === "categoricalX" ? 0 : -20, end: 20 },
    y: { start: logScale.value.y ? 1 : chartType === "categoricalY" ? 0 : -500, end: 500 },
  };

  const scaleArgs = {
    x: { extents: extents.x, log: logScale.value.x },
    y: { extents: extents.y, log: logScale.value.y },
  };

  const lineProps = {
    lineCount: xCategories.length * yCategories.length,
    pointCount: 200,
    xRange: { start: 0, end: 20 },
    yRange: { start: 0, end: 500 },
    cycles: 5,
    amplitude: 0.1,
  };


  const lines = generateWaveLines(lineProps) as any as Lines;

  lines.forEach((l, i) => {
    console.log(i);
    const cat = [
      {x: "A", y: "A"},
      {x: "B", y: "A"},
      {x: "A", y: "B"},
      {x: "B", y: "B"},
    ][i % 4];
    l.points = l.points.map(p => {
      return {
        x: [cat.x, p.x],
        y: [cat.y, p.y]
      }
    }) as any
    l.axisName = [
      undefined,
      { x: "xBottom", y: "yRight" } as const,
      { x: "xTop", y: "yLeft" } as const,
      { x: "xTop", y: "yRight" } as const,
    ][i % 4];
  });

  console.log(lines)

// TODO traces should filter lines that are for it?
// need an interface for this??
    ChartNew.start()
      .xTop().categorical().numerical()
      .xBottom().categorical().numerical()
      .yLeft().categorical().numerical()
      .yRight().categorical().numerical()
      .startHtml()
      .addElement(container)
      .startData()
      .registerLines(lines)
      .startConfig()
      .configureAxes({
        x: {
          start: [
            { label: { text: "CatLabel1X" }, innerPadding: 0.15, translate: 40 },
            { label: { text: "NumLabel1X", translate: -5 }, }
          ],
          end: [
            { label: { text: "CatLabel2X", translate: -20 }, innerPadding: 0.5 },
            { label: { text: "NumLabel2X", translate: -10 }, translate: 40 }
          ],
        },
        y: {
          // TODO disable borders if padding dont match between axis
          start: [
            { label: { text: "CatLabel1Y", translate: -30 }, innerPadding: 0.4, translate: 50 },
            { label: { text: "NumLabel1Y", translate: -7 } }
          ],
          end: [
            { label: { text: "CatLabel2Y", translate: -20 }, innerPadding: 0.2 },
            { label: { text: "NumLabel2Y" }, translate: 50 }
          ],
        },
      })
      .configureDomain({
        x: {
          start: [{ domain: ["A", "B"] }, { domain: [0, 20] }],
          end: [{ domain: ["A", "B"] }, { domain: [0, 20] }]
        },
        y: {
          start: [{ domain: ["A", "B"] }, { domain: [0, 500] }],
          end: [{ domain: ["A", "B"] }, { domain: [0, 500] }]
        },
      })
      .configureTicks({
        x: {
          start: [{ tick: { size: 10, translate: 10 } }, { tick: { translate: 0 } }],
          end: [{ tick: { size: 10, translate: 10 } }, { tick: { translate: 5 } }],
        },
        y: {
          start: [{ tick: { size: 10, translate: 10 } }, { tick: { translate: 5 } }],
          end: [{ tick: { size: 10, translate: 10 } }, { tick: { translate: 5 } }],
        }
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end()
  console.log("DOne")
  return
      // .configureCategories({ x: xCategories })
      // .configureScales(scaleArgs)
      // .configureTicks({
      //   x: { numerical: { count: 2 } },
      // })
      // .startVisual()
      // .addAxes()
      // .addTraces()
      // .startInteractive()
      // .end();

  if (chartType === "default") {
    // Use lines that will need to have negative values filtered when y-axis has log scale.
    const logFilterableLines = generateWaveLines({
      ...lineProps,
      yRange: { ...extents.y, start: extents.y.start - 200 },
      xRange: { ...extents.x, end: extents.x.end + 10 }
    });

    new ChartNew("default", container)
      .startData()
      .registerLines(logFilterableLines)
      .startConfig()
      .configureAxes({
        x: { label: { text: "Time" } },
        y: { label: { text: "Value" } },
      })
      .configureScales(scaleArgs)
      .configureTicks({
        y: { numerical: { specifier: ".1f", padding: 2, size: 5, count: 20 } },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    return;
  } else if (chartType === "categoricalXY") {
    new ChartNew("categoricalXY", container)
      .startData()
      .registerLines(lines.map((line, i) => ({
        ...line,
        category: {
          x: xCategories[i % xCategories.length],
          y: yCategories[i % yCategories.length],
        },
      })))
      .startConfig()
      .configureAxes({
        x: { label: { text: "X Category", padding: 70 }, innerPadding: 0.2 },
        y: { label: { text: "Y Category", padding: 50 }, innerPadding: 0.25 },
      })
      .configureCategories({
        x: xCategories,
        y: yCategories,
      })
      .configureScales(scaleArgs)
      .configureTicks({
        x: {
          categorical: { formatter: (v) => v.toLowerCase() },
          numerical: { count: 3 }
        },
        y: {
          categorical: { formatter: (v) => v.toUpperCase(), padding: 40 },
        },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    return;
  } else if (chartType === "categoricalX") {
    new ChartNew("categoricalX", container)
      .startData()
      .registerLines(lines.map((line, i) => ({
        ...line,
        category: {
          x: xCategories[i % xCategories.length],
        },
      })))
      .startConfig()
      .configureAxes({
        x: { label: { text: "X Category", padding: 70 } },
        y: { label: { text: "Value" } },
      })
      .configureCategories({ x: xCategories })
      .configureScales(scaleArgs)
      .configureTicks({
        x: { numerical: { count: 2 } },
      })
      .startVisual()
      .addAxes()
      .addTraces()
      .startInteractive()
      .end();
    return;
  }

  new ChartNew("categoricalY", container)
    .startData()
    .registerLines(lines.map((line, i) => ({
      ...line,
      category: {
        y: yCategories[i % yCategories.length],
      },
    })))
    .startConfig()
    .configureAxes({
      x: { label: { text: "Time" } },
      y: { label: { text: "Y Category" }, innerPadding: 0 },
    })
    .configureCategories({ y: yCategories })
    .configureScales(scaleArgs)
    .startVisual()
    .addAxes()
    .addTraces()
    .startInteractive()
    .end();
};

const drawStressChart = () => {
  const container = chartStress.value;
  if (!container) {
    return;
  }
  const extents = {
    x: { start: logScale.value.x ? 1 : -20, end: 20 },
    y: { start: logScale.value.y ? 1 : -500, end: 500 },
  };
  const lines = generateWaveLines({
    lineCount: 1000,
    pointCount: 1000,
    xRange: extents.x,
    yRange: extents.y,
    cycles: 5,
    amplitude: 0.2,
    opacity: 0.1,
  });
  new ChartNew("default", container)
    .startData()
    .registerLines(lines)
    .startConfig()
    .configureAxes({
      x: { label: { text: "Time" } },
      y: { label: { text: "Value" } },
    })
    .configureLines({ RDPEpsilon: 1 })
    .configureScales({
      x: { extents: extents.x, log: logScale.value.x },
      y: { extents: extents.y, log: logScale.value.y },
    })
    .configureTicks({
      y: { numerical: { specifier: ".1f", padding: 2, size: 5, count: 20 } },
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
  renderMathJaxChart();
  selectedChartTypes.value.forEach(renderChart);
}, { deep: true });

onMounted(() => {
  selectedChartTypes.value.forEach(renderChart);

  renderMathJaxChart();
});
</script>
