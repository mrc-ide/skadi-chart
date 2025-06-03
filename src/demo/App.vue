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

  <h1>Chart with tooltips</h1>
  <div class="chart" ref="chartTooltips" id="chartTooltips"></div>

  <h1>Responsive chart</h1>
  <div class="chart-responsive" ref="chartResponsive" id="chartResponsive"></div>

  <h1>Stress test: 1000 traces</h1>
  <button @click="drawStressChart">Draw</button>
  <div class="chart" ref="chartStress" id="chartStress"></div>
</template>

<script setup lang="ts">
import { Chart, Lines, Scales } from "../skadi-chart";
import { onMounted, ref } from "vue";

const chart = ref<HTMLDivElement | null>(null);

// can safely ignore all generating code, it just allows me to easily make
// pretty pictures
// 
// only important ones are nX and nL, number of points per line and number of
// lines
const nX = 1000;
const nL = 1000;

const ampScaling = 3;
const freqRange = 0.1;
const freqOffset = 0.95;
const phaseRange = 0.5;
const phaseOffset = 0.25;
const opacityRange = 0.5;
const opacityOffset = 0.2;

const makeRandomCurves = () => {
  const xPoints = Array.from({length: nX + 1}, (_, i) => i / nX);
  const lines: Lines = [];
  const makeYFunc = () => {
    const amp1 = Math.random();
    const amp2 = Math.random();
    const amp3 = Math.random();
    const amp4 = Math.random();
    const freq1 = Math.random() * freqRange + freqOffset;
    const freq2 = Math.random() * freqRange + freqOffset;
    const freq3 = Math.random() * freqRange + freqOffset;
    const freq4 = Math.random() * freqRange + freqOffset;
    const phase1 = Math.random() * phaseRange + phaseOffset;
    const phase2 = Math.random() * phaseRange + phaseOffset;
    const phase3 = Math.random() * phaseRange + phaseOffset;
    const phase4 = Math.random() * phaseRange + phaseOffset;
    return (x: number) => {
      return amp1 * Math.sin(freq1 * 53 * x + phase1)
        + amp2 * Math.cos(freq2 * 31 * x + phase2)
        + amp3 * Math.sin(freq3 * 26 * x + phase3)
        + amp4 * Math.cos(freq4 * 67 * x + phase4)
    };
  };

  // rainbow
  const colors = [
    "#e81416",
    "#ffa500",
    "#faeb36",
    "#79c314",
    "#487de7",
    "#4b369d",
    "#70369d"
  ];

  const randomIndex = (length: number) => {
    return Math.floor(Math.random() * length);
  };

  for (let l = 0; l < nL; l++) {
    const line: Lines[number] = {
      points: [],
      style: {
        opacity: Math.random() * opacityRange + opacityOffset,
        color: colors[randomIndex(colors.length)],
        strokeWidth: Math.random() * 0.5
      }
    };
    const yfunc = makeYFunc();
    for (let i = 0; i < nX + 1; i++) {
      line.points.push({ x: xPoints[i], y: yfunc(xPoints[i]) * ampScaling });
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

const scales: Scales = { x: {start: 0, end: 1}, y: {start: -10, end: 10} };

const drawStressChart = () => {
  const curvesStress = makeRandomCurves(propsStress);
  new Chart(scales)
    .addZoom()
    .addTraces(curvesStress)
    .addAxes()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartStress.value!);
};

onMounted(async () => {
  const scales: Scales = { x: {start: 0, end: 1}, y: {start: -10, end: 10} };
  new Chart(scales)
    .addZoom()
    .addTraces(makeRandomCurves())
    .addAxes()
    .makeResponsive()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chart.value!)
});
</script>
