<template>
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
  <button @click="() => numericalAxesLogScaleX = !numericalAxesLogScaleX">Toggle log scale X</button>
  <button @click="() => numericalAxesLogScaleY = !numericalAxesLogScaleY">Toggle log scale Y</button>

  <h1>Scatter points, axes, zoom with locked X axis and initial zoom (double click graph)</h1>
  <div class="chart" ref="chartPointsAxesAndZoom" id="chartPointsAxesAndZoom"></div>

  <h1>Chart with tooltips</h1>
  <div class="chart" ref="chartTooltips" id="chartTooltips"></div>

  <h1>Categorical y axis with traces and log scales and configured margins</h1>
  <div class="chart" ref="chartCategoricalYAxis" id="chartCategoricalYAxis"></div>
  <button @click="() => categoricalYAxisLogScaleX = !categoricalYAxisLogScaleX">Toggle log scale X</button>
  <button @click="() => categoricalYAxisLogScaleY = !categoricalYAxisLogScaleY">Toggle log scale Y</button>

  <h1>Categorical x axis with traces and log scales</h1>
  <div class="chart" ref="chartCategoricalXAxis" id="chartCategoricalXAxis"></div>
  <button @click="() => categoricalXAxisLogScaleX = !categoricalXAxisLogScaleX">Toggle log scale X</button>
  <button @click="() => categoricalXAxisLogScaleY = !categoricalXAxisLogScaleY">Toggle log scale Y</button>

  <h1>Area</h1>
  <div class="chart" ref="chartArea" id="chartArea"></div>

  <h1>Ridgeline plot with configurable clip-path and axis-constrained tooltips</h1>
  <div class="chart" ref="chartOverlappingBandsY" id="chartOverlappingBandsY"></div>

  <h1>Responsive chart (and dashed lines)</h1>
  <div class="chart-responsive" ref="chartResponsive" id="chartResponsive"></div>

  <h1>Custom layers + custom lifecycle hooks</h1>
  <div class="chart" ref="chartCustom" id="chartCustom"></div>

  <h1>With MathJax (experimental)</h1>
  <div class="chart" ref="chartMathJax" id="chartMathJax"></div>

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
import { PointWithMetadata, ScatterPoints } from "@/types";
import { Chart, LayerArgs, LayerType, Lines, OptionalLayer, Scales } from "../skadi-chart";
import { onMounted, ref, watch } from "vue";

const chartSparkLines = ref<HTMLDivElement | null>(null);
const chartOnlyAxes = ref<HTMLDivElement | null>(null);
const chartAxesAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelsAndGrid = ref<HTMLDivElement | null>(null);
const chartAxesLabelGridAndZoom = ref<HTMLDivElement | null>(null);
const chartAxesLabelGridZoomAndLogScale = ref<HTMLDivElement | null>(null);
const chartPointsAxesAndZoom = ref<HTMLDivElement | null>(null);
const chartTooltips = ref<HTMLDivElement | null>(null);
const chartOverlappingBandsY = ref<HTMLDivElement | null>(null);
const chartResponsive = ref<HTMLDivElement | null>(null);
const chartArea = ref<HTMLDivElement | null>(null);
const chartStress = ref<HTMLDivElement | null>(null);
const chartStressPoints = ref<HTMLDivElement | null>(null);
const chartCustom = ref<HTMLDivElement | null>(null);
const chartMathJax = ref<HTMLDivElement | null>(null);

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

const makeRandomPointsForCategoricalAxis = (domain: string[], axis: "x" | "y"): ScatterPoints<Metadata> => {
  return makeRandomPoints(pointPropsBasic).map((point, index) => {
    const band = domain[index % domain.length];
    const color = colors[index % domain.length];
    return {
      ...point,
      bands: { [axis]: band },
      style: { ...point.style, color },
      metadata: { ...point.metadata, color }
    }
  });
};

const makeRandomCurves = (props: typeof propsBasic, withArea?: boolean) => {
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
    const addArea = !!withArea;
    const opacity = Math.random() * props.opacityRange + props.opacityOffset;
    const line: Lines<Metadata>[number] = {
      points: [],
      fill: !!withArea,
      style: {
        opacity,
        strokeColor: color,
        strokeWidth: Math.random() * 1,
        fillColor: addArea ? color : undefined,
        fillOpacity: addArea ? opacity / 10 : undefined
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

const makeRandomCurvesForCategoricalAxis = (domain: string[], axis: "x" | "y", withArea?: boolean): Lines<Metadata> => {
  return makeRandomCurves(propsBasic, withArea).map((line, index) => {
    const band = domain[index % domain.length];
    const color = colors[index % domain.length];

    return {
      ...line,
      points: line.points.map((p, i) => {
        let y = p.y;
        // Make one line be an increasing line in the positive part of the band, to ensure that the positive part
        // is on the right side of 0, and so are the axis ticks, and that the scale increases in the expected direction.
        if (index === 0) { y = 1e3 * i; }
        // Make another line near 0 to check that the scale/ticks are in the right place.
        else if (index === 1) { y = 1; }
        return { ...p, y };
      }),
      bands: { [axis]: band },
      style: { ...line.style, strokeColor: color },
      metadata: { ...line.metadata, color }
    }
  })
};

const tooltipHtmlCallback = (point: PointWithMetadata<Metadata>) => {
  return `<div style="color: ${point.metadata?.color || "black"};">X: ${point.x.toFixed(3)}, Y: ${point.y.toFixed(3)}`
    + (point.bands?.x ? `<br/>Band X: ${point.bands?.x}` : ``)
    + (point.bands?.y ? `<br/>Band Y: ${point.bands?.y}` : ``)
    + `</div>`
};

const categoricalYAxis = ["Category A", "Category B", "Category C", "Category D", "Category E"];
const categoricalXAxis = ["Left", "Right"];
const chartCategoricalYAxis = ref<HTMLDivElement | null>(null);
const chartCategoricalXAxis = ref<HTMLDivElement | null>(null);
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
const curvesArea = makeRandomCurves({ ...propsBasic, nL: 5 }, true);
const pointsTooltips = makeRandomPoints(pointPropsTooltips);
const curvesResponsive = makeRandomCurves(propsBasic);
const curvesCustom = makeRandomCurves(propsBasic);
const curvesMathJax = makeRandomCurves(propsBasic);
const curvesCategoricalXAxis = makeRandomCurvesForCategoricalAxis(categoricalXAxis, "x");
const curvesCategoricalYAxis = makeRandomCurvesForCategoricalAxis(categoricalYAxis, "y");
const pointsCategoricalXAxis = makeRandomPointsForCategoricalAxis(categoricalXAxis, "x");
const pointsCategoricalYAxis = makeRandomPointsForCategoricalAxis(categoricalYAxis, "y");
const curvesOverlappingBandsY = makeRandomCurvesForCategoricalAxis(categoricalYAxis, "y", true);
curvesOverlappingBandsY.forEach(l => l.points = l.points.map(p => ({ ...p, y: Math.max(p.y, 0) })));

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

const numericalAxesLogScaleX = ref<boolean>(false);
const numericalAxesLogScaleY = ref<boolean>(false);

const drawChartAxesLabelGridZoomAndLogScale = () => {
  new Chart({ logScale: { x: numericalAxesLogScaleX.value, y: numericalAxesLogScaleY.value }})
    .addTraces(curvesAxesLabelGridZoomAndLogScale)
    .addScatterPoints(pointsAxesLabelGridZoomAndLogScale)
    .addAxes(axesLabels)
    .addGridLines()
    .addZoom()
    .appendTo(chartAxesLabelGridZoomAndLogScale.value!, { y: {start: -3e6, end: 3e6} });
};

watch([numericalAxesLogScaleX, numericalAxesLogScaleY], () => {
  drawChartAxesLabelGridZoomAndLogScale();
});

const categoricalYAxisLogScaleX = ref<boolean>(false);
const categoricalYAxisLogScaleY = ref<boolean>(false);

const drawChartCategoricalYAxis = () => {
  new Chart({
    logScale: { x: categoricalYAxisLogScaleX.value, y: categoricalYAxisLogScaleY.value },
    tickConfig: {
      numerical: {
        x: { specifier: categoricalYAxisLogScaleX.value ? "e" : undefined },
        y: { specifier: ".0f", count: 1 },
      },
      categorical: {
        y: { padding: 30 }
      }
    },
  })
    .addAxes({ x: "Time", y: "Category" }, { y: 0.2, x: 0.4 })
    .addGridLines({ x: true })
    .addTraces(curvesCategoricalYAxis)
    .addScatterPoints(pointsCategoricalYAxis)
    .addZoom()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(
      chartCategoricalYAxis.value!,
      scales,
      {},
      { y: categoricalYAxis },
      { left: 150, bottom: 70, right: 10 },
    );
};

watch([categoricalYAxisLogScaleX, categoricalYAxisLogScaleY], () => {
  drawChartCategoricalYAxis();
});

const categoricalXAxisLogScaleX = ref<boolean>(false);
const categoricalXAxisLogScaleY = ref<boolean>(false);

const drawChartCategoricalXAxis = () => {
  const numericalTickFormatter = categoricalXAxisLogScaleX.value ? (num: number): string => {
    let [mantissa, exponent] = num.toExponential().split("e");
    return `${mantissa === "1" ? `` : `${mantissa} * `}10^${exponent.replace("+", "")}`;
  } : undefined;

  new Chart({
    logScale: { x: categoricalXAxisLogScaleX.value, y: categoricalXAxisLogScaleY.value },
    categoricalScalePaddingInner: { x: 0.05 },
    tickConfig: {
      numerical: { x: { formatter: numericalTickFormatter } },
      categorical: { x: { padding: 36, formatter: (s) => s.toLocaleUpperCase() } },
    },
  })
    .addAxes({ x: "Category", y: "Value" })
    .addTraces(curvesCategoricalXAxis)
    .addScatterPoints(pointsCategoricalXAxis)
    .addZoom()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chartCategoricalXAxis.value!, scales, {}, { x: categoricalXAxis });
};

watch([categoricalXAxisLogScaleX, categoricalXAxisLogScaleY], () => {
  drawChartCategoricalXAxis();
});

onMounted(async () => {
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
    .addTraces(curvesArea)
    .addAxes()
    .addArea()
    .addZoom()
    .appendTo(chartArea.value!);

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

  drawChartAxesLabelGridZoomAndLogScale();

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

  drawChartCategoricalYAxis();
  drawChartCategoricalXAxis();

  curvesResponsive.forEach((l, i) => {
    l.style.strokeDasharray = `${i * 2} 5`
  });
  new Chart()
    .addTraces(curvesResponsive)
    .addAxes()
    .addGridLines()
    .makeResponsive()
    .appendTo(chartResponsive.value!);

  new Chart({ tickConfig: { numerical: { x: { size: 8, padding: 2 }, y: { count: 0 } } } })
    .addAxes({ x: "Time", y: "Category" })
    .addTraces(curvesOverlappingBandsY)
    .addArea()
    .addZoom()
    .addTooltips(tooltipHtmlCallback, Infinity, "x")
    .appendTo(
      chartOverlappingBandsY.value!,
      { x: scales.x, y: { start: 0, end: scales.y.end / 3 } }, // Limit y scale to force values to exceed band height
      {},
      { y: categoricalYAxis },
      { left: 150, bottom: 70, right: 10 },
      { margin: { top: -100 } },
    );

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


  const mathJaxFormatter = (num: number) => `$${num}^{1}$`
  new Chart({
    tickConfig: { numerical: { x: { formatter: mathJaxFormatter, enableMathJax: true } } }
  })
    .addTraces(curvesMathJax)
    .addAxes(axesLabels)
    .appendTo(chartMathJax.value!);
});
</script>
