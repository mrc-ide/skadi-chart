<template>
  <div style="height: 40vh; width: 75vw;" ref="chart" class="bordered"></div>
</template>

<style lang="css" scoped>
.bordered {
  border: solid black 1px;
}
</style>

<script setup lang="ts">
import { Chart } from "../skadi-chart";
import { onMounted, ref } from "vue";

const chart = ref<HTMLDivElement | null>(null);

type DataJson = {
  x: number[],
  y: number[],
  line: {
    color: string,
    width: number,
    opacity: number
  },
  name: string
}[];

const transformRawData = (data: DataJson): any => {
  return data.map(d => {
    const pointsArr: {x: number, y: number}[] = [];
    for (let i = 0; i < d.x.length; i++) {
      pointsArr.push({ x: d.x[i], y: d.y[i] });
    }
    return {
      points: pointsArr,
      style: {
        color: d.line.color,
        strokeWidth: d.line.width,
        opacity: d.line.opacity
      }
    };
  });
};

const data = ref<any | null>(null);
const getData = async () => {
  const raw = await fetch("./data.json");
  const rawJson = await raw.json() as DataJson;
  data.value = transformRawData(rawJson);
};

const tooltipHtmlCallback = (point: {x: number, y: number}) => {
  return `X: ${point.x}, Y: ${point.y}`;
};

onMounted(async () => {
  await getData();
  const scales: any = { x: {start: 0, end: 100}, y: {start: -200, end: 1000} };
  new Chart(scales)
    .addZoom()
    .addTraces(data.value!)
    .addAxes()
    .makeResponsive()
    .addTooltips(tooltipHtmlCallback)
    .appendTo(chart.value!)
});
</script>
