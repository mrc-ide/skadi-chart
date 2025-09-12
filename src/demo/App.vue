<template>
  <h1>Categorical axis</h1>
  <div class="chart" ref="chartCategoricalAxis" id="chartCategoricalAxis"></div>

  <h1>Basic traces (spark lines)</h1>
  <div class="chart" ref="chartSparkLines" id="chartSparkLines"></div>

  <h1>Chart with axes (with a fixed scale)</h1>
  <div class="chart" ref="chartOnlyAxes" id="chartOnlyAxes"></div>

  <h1>Axes and gridlines</h1>
  <div class="chart" ref="chartAxesAndGrid" id="chartAxesAndGrid"></div>

  <h1>Axes, labels and gridlines</h1>
  <div class="chart" ref="chartAxesLabelsAndGrid" id="chartAxesLabelsAndGrid"></div>

  <h1>Traces, gridlines, axes, labels and zoom</h1>
  <div class="chart" ref="chartAxesLabelGridAndZoom" id="chartAxesLabelGridAndZoom"></div>
  <button @click="() => exportToPng!('zoomPlot.png')">Download PNG</button>

  <h1>Traces, gridlines, axes, labels, zoom and log scale toggle</h1>
  <div class="chart" ref="chartAxesLabelGridZoomAndLogScale" id="chartAxesLabelGridZoomAndLogScale"></div>
  <button @click="() => logScaleX = !logScaleX">Toggle log scale X</button>
  <button @click="() => logScaleY = !logScaleY">Toggle log scale Y</button>

  <h1>Scatter points, axes, zoom with locked X axis and initial zoom (double click graph)</h1>
  <div class="chart" ref="chartPointsAxesAndZoom" id="chartPointsAxesAndZoom"></div>

  <h1>Chart with tooltips</h1>
  <div class="chart" ref="chartTooltips" id="chartTooltips"></div>

  <h1>Responsive chart (and dashed lines)</h1>
  <div class="chart-responsive" ref="chartResponsive" id="chartResponsive"></div>

  <h1>Custom layers + custom lifecycle hooks</h1>
  <div class="chart" ref="chartCustom" id="chartCustom"></div>

  <h1>Stress test: 1000 traces</h1>
  <button @click="drawStressChart">Draw</button>
  <div class="chart" ref="chartStress" id="chartStress"></div>

  <h1>Stress test: 10,000 points</h1>
  <button @click="drawStressChartPoints">Draw</button>
  <div class="chart" ref="chartStressPoints" id="chartStressPoints"></div>
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
import { ScatterPoints } from "@/types";
import { Chart, LayerArgs, LayerType, Lines, OptionalLayer, Scales } from "../skadi-chart";
import { onMounted, ref, watch } from "vue";

const chartCategoricalAxis = ref<HTMLDivElement | null>(null);
const chartSparkLines = ref<HTMLDivElement | null>(null);
const chartOnlyAxes = ref<HTMLDivElement | null>(null);
const chartAxesAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelsAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelGridAndZoom = ref<HTMLDivElement | null>(null);
const chartAxesLabelGridZoomAndLogScale = ref<HTMLDivElement | null>(null);
const chartPointsAxesAndZoom = ref<HTMLDivElement | null>(null);
const chartTooltips = ref<HTMLDivElement | null>(null);
const chartResponsive = ref<HTMLDivElement | null>(null);
const chartStress = ref<HTMLDivElement | null>(null);
const chartStressPoints = ref<HTMLDivElement | null>(null);
const chartCustom = ref<HTMLDivElement | null>(null);

const pointPropsBasic = {
  n: 1000,
  ampScaling: 1e6,
  opacityRange: 0.5,
  opacityOffset: 0.5,
  radiusRange: 2,
  radiusOffset: 0.5,
}

const pointPropsTooltips = {
  n: 1000,
  ampScaling: 1.5e6,
  opacityRange: 0.5,
  opacityOffset: 0.5,
  radiusRange: 2,
  radiusOffset: 0.5,
}

const pointPropsStress = {
  n: 10000,
  ampScaling: 1.5e6,
  opacityRange: 0.5,
  opacityOffset: 0,
  radiusRange: 1.5,
  radiusOffset: 0.2,
}

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
  nL: 1000,
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

// rainbow
const colors = [ "#e81416", "#ffa500", "#faeb36", "#79c314", "#487de7", "#4b369d", "#70369d" ];

const randomIndex = (length: number) => {
  return Math.floor(Math.random() * length);
};

type Metadata = { color: string }

const makeRandomPoints = (props: typeof pointPropsBasic) => {
  const xPoints = Array.from({length: props.n + 1}, () => Math.random());
  const points: ScatterPoints<Metadata> = [];
  const y = () => {
    const rand = (Math.random() - 0.5) * 2;
    const e = rand * rand * rand;
    return Math.atan(1/e) * props.ampScaling;
  };

  for (let i = 0; i < props.n; i++) {
    const color = colors[randomIndex(colors.length)];
    const scatterPoint: ScatterPoints<Metadata>[number] = {
      x: xPoints[i], y: y(),
      style: {
        radius: Math.random() * props.radiusRange + props.radiusOffset,
        color,
        opacity: Math.random() * props.opacityRange + props.opacityOffset
      },
      metadata: { color }
    };
    points.push(scatterPoint);
  }
  return points;
};

const makeRandomCurves = (props: typeof propsBasic) => {
  const xPoints = Array.from({length: props.nX + 1}, (_, i) => i / props.nX);
  const lines: Lines<Metadata> = [];
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

  for (let l = 0; l < props.nL; l++) {
    const color = colors[randomIndex(colors.length)];
    const line: Lines<Metadata>[number] = {
      points: [],
      style: {
        opacity: Math.random() * props.opacityRange + props.opacityOffset,
        color,
        strokeWidth: Math.random() * 1
      },
      metadata: { color }
    };
    const yfunc = makeYFunc();
    for (let i = 0; i < props.nX + 1; i++) {
      line.points.push({ x: xPoints[i], y: yfunc(xPoints[i]) * props.ampScaling });
    }
    lines.push(line);
  }
  return lines;
};

const categoricalDomainAgain = ["A", "B", "C"]

const tooltipHtmlCallback = (point: {x: number, y: number, metadata?: Metadata}, bandName: string) => {
  const categoryAccordingToPointMetadata = point.metadata?.category!;
  const agreement = categoryAccordingToPointMetadata === bandName;
  const categoryIndex = categoricalDomainAgain.findIndex(c => c === bandName);
  const textColor = ["green", "orange", "turquoise", "blue"][categoryIndex] ?? "lightgrey";
  return `<div style="color: ${textColor}; border: 1px solid black; padding: 5px;">
    X: ${point.x.toFixed(3)}, Y: ${point.y.toFixed(3)}
    <br/>
    <span style="color: ${agreement ? "green" : "red" }">Category according to point metadata: ${categoryAccordingToPointMetadata}</span>
    <br/>Band according to tooltip layer: ${bandName ?? "none"}
    <br/>point.metadata.category index: ${categoryIndex}
  </div>`;
};

const curvesSparkLines = makeRandomCurves(propsBasic);
const curvesOnlyAxes = makeRandomCurves(propsBasic);
const curvesAxesAndGrid = makeRandomCurves(propsBasic);
const curvesAxesLabelsAndGrid = makeRandomCurves(propsBasic);
const curvesAxesLabelGridAndZoom = makeRandomCurves(propsBasic);
const curvesAxesLabelGridZoomAndLogScale = makeRandomCurves(propsBasic);
curvesAxesLabelGridZoomAndLogScale.forEach(l => l.points.forEach(p => p.x -= 0.5));
const pointsAxesLabelGridZoomAndLogScale = makeRandomPoints(pointPropsBasic);
pointsAxesLabelGridZoomAndLogScale.forEach(p => p.x -= 0.5);
const pointsPointsAxesAndZoom = makeRandomPoints(pointPropsBasic);
const curvesTooltips = makeRandomCurves(propsBasic);
const pointsTooltips = makeRandomPoints(pointPropsTooltips);
const curvesResponsive = makeRandomCurves(propsBasic);
const curvesCustom = makeRandomCurves(propsBasic);

const scales: Scales = { x: {start: 0, end: 1}, y: {start: -3e6, end: 3e6} };

const drawStressChart = () => {
  const curvesStress = makeRandomCurves(propsStress);
  new Chart()
    .addZoom()
    .addTraces(curvesStress, { RDPEpsilon: 1 })
    .addAxes()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartStress.value!);
};

const drawStressChartPoints = () => {
  const pointsStress = makeRandomPoints(pointPropsStress);
  new Chart()
    .addZoom()
    .addScatterPoints(pointsStress)
    .addAxes()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartStressPoints.value!);
};

const axesLabels = { x: "Time", y: "Value" };

const exportToPng = ref<(name?: string) => void>();

const logScaleY = ref<boolean>(false);
const logScaleX = ref<boolean>(false);

watch([logScaleY, logScaleX], () => {
  new Chart({ logScale: { y: logScaleY.value, x: logScaleX.value }})
    .addTraces(curvesAxesLabelGridZoomAndLogScale)
    .addScatterPoints(pointsAxesLabelGridZoomAndLogScale)
    .addAxes(axesLabels)
    .addGridLines()
    .addZoom()
    .appendTo(chartAxesLabelGridZoomAndLogScale.value!);
});

// TODO: Adapt scatter point layer to support numerical coord in categorical axes (so we can stack scatter plots),
// as well as string y. This would make it able to behave more like the traces layer does but we should keep the
// ability to plot against just the category (effectively coord = 0) as a bar chart would. Only then implement tooltips.
const myPoints = [
  { x: 0.1, y: "a", metadata: { category: "a" } },
  { x: 0.2, y: "bee", metadata: { category: "bee" } },
  { x: 0.3, y: "a", metadata: { category: "a" } },
  { x: 0.4, y: "a", metadata: { category: "a" } },
  { x: 0.5, y: "a", metadata: { category: "a" } },
  { x: 0.6, y: "bee", metadata: { category: "bee" } },
  { x: 0.7, y: "sea", metadata: { category: "sea" } },
  { x: 0.8, y: "a", metadata: { category: "a" } },
  { x: 0.9, y: "D3", metadata: { category: "D3" } },
  { x: 0.95, y: "D3", metadata: { category: "D3" } },
]

onMounted(async () => {
  new Chart()
    .addAxes(axesLabels)
    // .addScatterPoints([], myPoints)
    .addTraces([], {}, curvesSparkLines.map((line, index) => {
      const category = categoricalDomainAgain[index % categoricalDomainAgain.length];

      return {
        ...line,
        metadata: { category },
      }
    }))
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartCategoricalAxis.value!, scales);

  new Chart()
    .addTraces(curvesSparkLines)
    .appendTo(chartSparkLines.value!);

  new Chart()
    .addTraces(curvesOnlyAxes)
    .addAxes()
    .appendTo(chartOnlyAxes.value!, scales);

  new Chart()
    .addTraces(curvesAxesAndGrid)
    .addAxes()
    .addGridLines()
    .appendTo(chartAxesAndGrid.value!);

  new Chart()
    .addTraces(curvesAxesLabelsAndGrid)
    .addAxes(axesLabels)
    .addGridLines()
    .appendTo(chartAxesLabelsAndGrid.value!);

  const chart = new Chart()
    .addTraces(curvesAxesLabelGridAndZoom)
    .addAxes(axesLabels)
    .addGridLines()
    .addZoom()
    .appendTo(chartAxesLabelGridAndZoom.value!);
  exportToPng.value = chart.exportToPng!;

  new Chart({ logScale: { y: logScaleY.value, x: logScaleX.value } })
    .addTraces(curvesAxesLabelGridZoomAndLogScale)
    .addScatterPoints(pointsAxesLabelGridZoomAndLogScale)
    .addAxes(axesLabels)
    .addGridLines()
    .addZoom()
    .appendTo(chartAxesLabelGridZoomAndLogScale.value!);

  new Chart()
    .addScatterPoints(pointsPointsAxesAndZoom)
    .addAxes(axesLabels)
    .addZoom({ lockAxis: "x" })
    .appendTo(chartPointsAxesAndZoom.value!, scales, { y: { start: -2e6, end: -0.5e6 } });

  new Chart<Metadata>()
    .addTraces(curvesTooltips)
    .addScatterPoints(pointsTooltips)
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartTooltips.value!);

  curvesResponsive.forEach((l, i) => {
    l.style.strokeDasharray = `${i * 2} 5`
  });
  new Chart()
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
  new Chart()
    .addTraces(curvesCustom)
    .addAxes(axesLabels)
    .addGridLines()
    .addZoom()
    .addCustomLayer(new CustomLayer())
    .addCustomLifecycleHooks({
      beforeZoom(zoomExtents) {
        if (zoomExtents.eventType !== "dblclick") return;
        console.log("you double clicked!")
      },
      afterZoom(zoomExtents) {
        if (!zoomExtents) return;
        console.log("triggered after zoom")
      }
    })
    .appendTo(chartCustom.value!);
});
</script>
