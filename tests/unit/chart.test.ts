import { Chart } from "../../src/Chart";
import { AxesLayer } from "@/layers/AxesLayer";
import { TracesLayer } from "@/layers/TracesLayer";
import { ZoomLayer } from "@/layers/ZoomLayer";
import { TooltipsLayer } from "@/layers/TooltipsLayer";

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
});
