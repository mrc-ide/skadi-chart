<template>
  <h1>Basic traces (spark lines)</h1>
  <div class="chart" ref="chartSparkLines" id="chartSparkLines"></div>

  <h1>Chart with axes</h1>
  <div class="chart" ref="chartOnlyAxes" id="chartOnlyAxes"></div>

  <h1>Axes and gridlines</h1>
  <div class="chart" ref="chartAxesAndGrid" id="chartAxesAndGrid"></div>

  <h1>Axes, labels and gridlines</h1>
  <div class="chart" ref="chartAxesLabelsAndGrid" id="chartAxesLabelsAndGrid"></div>

  <h1>Traces, gridlines, axes, labels and zoom</h1>
  <div class="chart" ref="chartAxesLabelGridAndZoom" id="chartAxesLabelGridAndZoom"></div>
  <button @click="() => exportToPng!('zoomPlot.png')">Download PNG</button>

  <h1>Chart with tooltips</h1>
  <div class="chart" ref="chartTooltips" id="chartTooltips"></div>

  <h1>Responsive chart</h1>
  <div class="chart-responsive" ref="chartResponsive" id="chartResponsive"></div>

  <h1>Custom layers + custom lifecycle hooks</h1>
  <div class="chart" ref="chartCustom" id="chartCustom"></div>

  <h1>Stress test: 800 traces</h1>
  <button @click="drawStressChart">Draw</button>
  <div class="chart" ref="chartStress" id="chartStress"></div>
</template>

<style>
.chart {
  width: 1000px;
  height: 500px;
}

.chart-responsive {
  width: 60vw;
  height: 55vh;
}
</style>

<script setup lang="ts">
import { Chart, LayerArgs, LayerType, Lines, OptionalLayer, Scales } from "../skadi-chart";
import { onMounted, ref } from "vue";

const chartSparkLines = ref<HTMLDivElement | null>(null);
const chartOnlyAxes = ref<HTMLDivElement | null>(null);
const chartAxesAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelsAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelGridAndZoom = ref<HTMLDivElement | null>(null);
const chartTooltips = ref<HTMLDivElement | null>(null);
const chartResponsive = ref<HTMLDivElement | null>(null);
const chartStress = ref<HTMLDivElement | null>(null);
const chartCustom = ref<HTMLDivElement | null>(null);

const propsBasic = {
  nX: 1000,
  nL: 10,
  ampScaling: 1e6,
  freqRange: 0.1,
  freqOffset: 0.95,
  phaseRange: 0.5,
  phaseOffset: 0.25,
  opacityRange: 0.2,
  opacityOffset: 0.8,
  strokeWidthRange: 0.1,
  strokeWidthOffset: 0.9,
}

const propsStress = {
  nX: 1000,
  nL: 800,
  ampScaling: 1e6,
  freqRange: 0.1,
  freqOffset: 0.95,
  phaseRange: 0.5,
  phaseOffset: 0.25,
  opacityRange: 0.15,
  opacityOffset: 0.01,
  strokeWidthRange: 0.4,
  strokeWidthOffset: 0,
}

const makeRandomCurves = (props: typeof propsBasic) => {
  const xPoints = Array.from({length: props.nX + 1}, (_, i) => i / props.nX);
  const lines: Lines = [];
  const makeYFunc = () => {
    const amp1 = Math.random();
    const amp2 = Math.random();
    const amp3 = Math.random();
    const amp4 = Math.random();
    const freq1 = Math.random() * props.freqRange + props.freqOffset;
    const freq2 = Math.random() * props.freqRange + props.freqOffset;
    const freq3 = Math.random() * props.freqRange + props.freqOffset;
    const freq4 = Math.random() * props.freqRange + props.freqOffset;
    const phase1 = Math.random() * props.phaseRange + props.phaseOffset;
    const phase2 = Math.random() * props.phaseRange + props.phaseOffset;
    const phase3 = Math.random() * props.phaseRange + props.phaseOffset;
    const phase4 = Math.random() * props.phaseRange + props.phaseOffset;
    return (x: number) => {
      return amp1 * Math.sin(freq1 * 53 * x + phase1)
        + amp2 * Math.cos(freq2 * 31 * x + phase2)
        + amp3 * Math.sin(freq3 * 26 * x + phase3)
        + amp4 * Math.cos(freq4 * 67 * x + phase4)
    };
  };

  // rainbow
  const colors = [ "#e81416", "#ffa500", "#faeb36", "#79c314", "#487de7", "#4b369d", "#70369d" ];

  const randomIndex = (length: number) => {
    return Math.floor(Math.random() * length);
  };

  for (let l = 0; l < props.nL; l++) {
    const line: Lines[number] = {
      points: [],
      style: {
        opacity: Math.random() * props.opacityRange + props.opacityOffset,
        color: colors[randomIndex(colors.length)],
        strokeWidth: Math.random() * 1
      }
    };
    const yfunc = makeYFunc();
    for (let i = 0; i < props.nX + 1; i++) {
      line.points.push({ x: xPoints[i], y: yfunc(xPoints[i]) * props.ampScaling });
    }
    lines.push(line);
  }
  return lines;
};

const tooltipHtmlCallback = (point: {x: number, y: number}) => {
  return `X: ${point.x.toFixed(3)}, Y: ${point.y.toFixed(3)}`;
};

const curvesSparkLines = makeRandomCurves(propsBasic);
const curvesOnlyAxes = makeRandomCurves(propsBasic);
const curvesAxesAndGrid = makeRandomCurves(propsBasic);
const curvesAxesLabelsAndGrid = makeRandomCurves(propsBasic);
const curvesAxesLabelGridAndZoom = makeRandomCurves(propsBasic);
const curvesTooltips = makeRandomCurves(propsBasic);
const curvesResponsive = makeRandomCurves(propsBasic);
const curvesCustom = makeRandomCurves(propsBasic);

const scales: Scales = { x: {start: 0, end: 1}, y: {start: -3e6, end: 3e6} };

const drawStressChart = () => {
  const curvesStress = makeRandomCurves(propsStress);
  new Chart(scales)
    .addZoom()
    .addTraces(curvesStress, 1)
    .addAxes()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartStress.value!);
};

const exportToPng = ref<(name?: string) => void>();

onMounted(async () => {
  const axesLAbels = { x: "Time", y: "Value" };
  new Chart(scales)
    .addTraces(curvesSparkLines)
    .appendTo(chartSparkLines.value!);

  new Chart(scales)
    .addTraces(curvesOnlyAxes)
    .addAxes()
    .appendTo(chartOnlyAxes.value!);

  new Chart(scales)
    .addTraces(curvesAxesAndGrid)
    .addAxes()
    .addGridLines()
    .appendTo(chartAxesAndGrid.value!);

  new Chart(scales)
    .addTraces(curvesAxesLabelsAndGrid)
    .addAxes(axesLAbels)
    .addGridLines()
    .appendTo(chartAxesLabelsAndGrid.value!);

  const chart = new Chart(scales)
    .addTraces(curvesAxesLabelGridAndZoom)
    .addAxes(axesLAbels)
    .addGridLines()
    .addZoom()
    .appendTo(chartAxesLabelGridAndZoom.value!);
  exportToPng.value = chart.exportToPng!;

  new Chart(scales)
    .addTraces(curvesTooltips)
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartTooltips.value!);

  new Chart(scales)
    .addTraces(curvesResponsive)
    .addAxes()
    .addGridLines()
    .makeResponsive()
    .appendTo(chartResponsive.value!);

  class CustomLayer extends OptionalLayer {
    type = LayerType.Custom;
    constructor() { super() };
    draw(layerArgs: LayerArgs): void {
        const svg = layerArgs.coreLayers[LayerType.Svg];
        const { getHtmlId } = layerArgs;
        svg.append("svg:circle")
          .attr("id", `${getHtmlId(this.type)}-circle`)
          .attr("cx", "50%")
          .attr("cy", "50%")
          .attr("r", "5%")
    }
  }
  new Chart(scales)
    .addTraces(curvesCustom)
    .addAxes(axesLAbels)
    .addGridLines()
    .addZoom()
    .addCustomLayer(new CustomLayer())
    .addCustomLifecycleHook({
      afterZoom() { console.log("triggered after zoom") }
    })
    .appendTo(chartCustom.value!);
});
</script>
