import { Chart } from "../../src/Chart";
import { AxesLayer } from "@/layers/AxesLayer";
import { TracesLayer } from "@/layers/TracesLayer";
import { ZoomLayer } from "@/layers/ZoomLayer";
import { TooltipsLayer } from "@/layers/TooltipsLayer";
import { Lines, ScatterPoints } from "@/types";
import { ScatterLayer } from "@/layers/ScatterLayer";

describe("Chart tests", () => {
  test("constructor works as expected", () => {
    const chart = new Chart(); 
    expect(chart.id).not.toBe("");
    expect(chart.optionalLayers).toStrictEqual([]);
    expect(chart.isResponsive).toBe(false);
  });

  const expectLastAddedLayer = (chart: Chart) => {
    return {
      toBe: (l: typeof AxesLayer | typeof TracesLayer | typeof ZoomLayer | typeof TooltipsLayer) => {
        expect(chart.optionalLayers.at(-1)! instanceof l).toBe(true);
      }
    };
  };

  test("add functions work as expected", () => {
    const chart = new Chart();
    chart.addAxes();
    expectLastAddedLayer(chart).toBe(AxesLayer);
    chart.addTraces([]);
    expectLastAddedLayer(chart).toBe(TracesLayer);
    chart.addZoom();
    expectLastAddedLayer(chart).toBe(ZoomLayer);
    chart.addTooltips(() => "");
    expectLastAddedLayer(chart).toBe(TooltipsLayer);
  });

  test("make responsive sets boolean", () => {
    const chart = new Chart();
    chart.makeResponsive();
    expect(chart.isResponsive).toBe(true);
  });

  test("chart filters out non-positive numbers for log scale", () => {
    const lines: Lines<null> = [
      {
        points: [
          { x: -1, y: -1 },
          { x: -1, y: 1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: -1 },
        ],
        style: {}
      }
    ];
    const scatterPoints: ScatterPoints<null> = [
      { x: -1, y: -1, style: {} },
      { x: -1, y: 1, style: {} },
      { x: 1, y: -1, style: {} },
      { x: 1, y: 1, style: {} },
    ];

    const chart = new Chart({ logScale: { x: true, y: true } })
      .addTraces(lines)
      .addScatterPoints(scatterPoints);

    const filteredLines = (chart.optionalLayers[0] as TracesLayer<null>).linesDC;
    // filters points and splits into two disjoint lines
    expect(filteredLines).toStrictEqual([
      {
        points: [{ x: 1, y: 1 }],
        style: {}
      },
      {
        points: [{ x: 1, y: 1 }],
        style: {}
      }
    ]);

    const filteredScatterPoints = (chart.optionalLayers[1] as ScatterLayer<null>).points;
    expect(filteredScatterPoints).toStrictEqual([
      { x: 1, y: 1, style: {} },
    ]);
  });

  test("axes are autoscaled correctly in linear scale", () => {
    const lines: Lines<null> = [
      {
        points: [{ x: -1, y: -1 }],
        style: {}
      },
      {
        points: [{ x: 1, y: 1 }],
        style: {}
      },
    ];
    const scatterPoints: ScatterPoints<null> = [
      { x: 5, y: -1, style: {} },
    ];
    
    const chart = new Chart()
      .addTraces(lines)
      .addScatterPoints(scatterPoints)
      .appendTo(document.createElement("div"));

    const autoscaled = chart.autoscaledMaxExtents;
    // 2% of range on the x axis and 3% on the y
    expect(autoscaled).toStrictEqual({
      x: { start: -1.12, end: 5.12 },
      y: { start: -1.06, end: 1.06 },
    });
  });

  test("axes are autoscaled correctly in log scale", () => {
    const lines: Lines<null> = [
      {
        points: [{ x: 1, y: 1 }],
        style: {}
      },
      {
        points: [{ x: 1, y: 3 }],
        style: {}
      },
    ];
    const scatterPoints: ScatterPoints<null> = [
      { x: 5, y: 1, style: {} },
    ];
    
    const chart = new Chart({ logScale: { x: true, y: true } })
      .addTraces(lines)
      .addScatterPoints(scatterPoints)
      .appendTo(document.createElement("div"));

    const autoscaled = chart.autoscaledMaxExtents;
    // 2% on the log x axis and 3% on the log y
    const logXPaddingFactor = Math.exp(Math.log(5) * 0.02)
    const logYPaddingFactor = Math.exp(Math.log(3) * 0.03)

    // + and - in log space become * and / in normal space
    expect(autoscaled.x.start).toBeCloseTo(1 / logXPaddingFactor);
    expect(autoscaled.y.start).toBeCloseTo(1 / logYPaddingFactor);

    expect(autoscaled.x.end).toBeCloseTo(5 * logXPaddingFactor);
    expect(autoscaled.y.end).toBeCloseTo(3 * logYPaddingFactor);
  });
});
