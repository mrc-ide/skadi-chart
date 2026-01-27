import { LayerType } from "@/layers/Layer";
import { XY } from "@/types";
import { test, expect, Page, Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

class SkadiChartTest {
  selector: (layerType: LayerType, extra?: string) => Promise<Locator[]>;
  tests: Promise<void>[] = [];

  constructor(public page: Page, chartDivId: string) {
    const chartDiv = page.locator(`#${chartDivId}`);

    // The ids we use for elements are of the form
    // `<layerType>-<randomId>(-<extra>)` where -<extra> is
    // optional. We know what layerType we are querying for but
    // getting the randomId is a little trickier, here we just
    // parse the `svg-<randomId>` id of the svg element to
    // obtain the randomId
    this.selector = async (layerType: LayerType, extra?: string) => {
      const svgId = await chartDiv.locator("svg").getAttribute("id");
      const [, randomId] = svgId.split("-");
      const id = extra ? `${extra}-${layerType}-${randomId}` : `${layerType}-${randomId}`;
      // this returns any element that partially matches the id
      // and is useful for cases like traces where we have to
      // match `trace-<randomId>-0`, `trace-<randomId>-1`, ...
      // with just `trace-<randomId>`
      return await page.locator(`*[id*="${id}"]`).all();
    };

    return this;
  };

  private addTest = (callback: () => Promise<void>) => {
    this.tests.push(callback());
    return this;
  };

  expectNTraces = (n: number) => {
    return this.addTest(async () => {
      const traces = await this.selector(LayerType.Trace);
      expect(traces).toHaveLength(n);
    });
  };

  expectNPoints = (n: number) => {
    return this.addTest(async () => {
      const scatterPoints = await this.selector(LayerType.Scatter);
      expect(scatterPoints).toHaveLength(n);
    });
  };

  expectAxes = (numberOfAxes: XY<number> = { x: 1, y: 1 }) => {
    return this.addTest(async () => {
      const xAxis = await this.selector(LayerType.Axes, "x");
      expect(xAxis).toHaveLength(numberOfAxes.x);
      const yAxis = await this.selector(LayerType.Axes, "y");
      expect(yAxis).toHaveLength(numberOfAxes.y);
    });
  };

  expectGridlines = (directions: XY<boolean> = { x: true, y: true }) => {
    return this.addTest(async () => {
      if (directions.x) {
        const xGrid = await this.selector(LayerType.Grid, "x");
        expect(xGrid).toHaveLength(1);
      }
      if (directions.y) {
        const yGrid = await this.selector(LayerType.Grid, "y");
        expect(yGrid).toHaveLength(1);
      }
    });
  };

  expectLabels = (labels: Partial<XY<string>>) => {
    return this.addTest(async () => {
      if (labels.x) {
        const xLabel = await this.selector(LayerType.Axes, "labelx");
        await expect(xLabel[0]).toHaveText(labels.x);
      }
      if (labels.y) {
        const yLabel = await this.selector(LayerType.Axes, "labely");
        await expect(yLabel[0]).toHaveText(labels.y);
      }
    });
  };

  expectZoom = () => {
    return this.addTest(async () => {
      const zoomBrush = await this.selector(LayerType.Zoom, "brush");
      expect(zoomBrush).toHaveLength(1);
      const zoomOverlay = await this.selector(LayerType.Zoom, "overlay");
      expect(zoomOverlay).toHaveLength(1);
      const zoomSelection = await this.selector(LayerType.Zoom, "selection");
      expect(zoomSelection).toHaveLength(1);
    });
  };

  expectTooltip = () => {
    return this.addTest(async () => {
      const traces = await this.selector(LayerType.Trace);
      // This fails without force because playwright cannot hover
      // over the trace without the svg intercepting the hover. In
      // fact the svg intercepting the hover is how the tooltips work,
      // however to test the tooltips, we need to guarantee we are
      // over a trace so we force a hover on the trace even though it
      // doesn't trigger any events on it.
      await traces[0].hover({ force: true });
      const tooltip = await this.selector(LayerType.Tooltip);
      expect(tooltip).toHaveLength(1);
    });
  };

  expectCustomCircle = () => {
    return this.addTest(async () => {
      const circle = await this.selector(LayerType.Custom, "circle");
      expect(circle).toHaveLength(1);
    });
  };

  expectClipPath = (marginTop: number = 20) => {
    return this.addTest(async () => {
      const clipPath = await this.selector(LayerType.ClipPath);
      expect(clipPath).toHaveLength(1);
      const rect = clipPath[0].locator("rect");
      expect(rect).toHaveCount(1);
      expect(rect.getAttribute("y")).resolves.toBe(marginTop.toString());
    });
  }

  end = async () => {
    for (let i = 0; i < this.tests.length; i++) {
      await this.tests[i];
    }
  };
};


test("basic traces", async ({ page }) => {
  await new SkadiChartTest(page, "chartSparkLines")
    .expectNTraces(10)
    .end()
});

test("basic traces and axes", async ({ page }) => {
  await new SkadiChartTest(page, "chartOnlyAxes")
    .expectNTraces(10)
    .expectAxes()
    .end()
});

test("basic traces and axes and grid", async ({ page }) => {
  await new SkadiChartTest(page, "chartAxesAndGrid")
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .end()
});

test("basic traces and axes and grid and labels", async ({ page }) => {
  await new SkadiChartTest(page, "chartAxesLabelsAndGrid")
    .expectNTraces(10)
    .expectAxes()
    .expectClipPath()
    .expectGridlines()
    .expectLabels({ x: "Time", y: "Value" })
    .end()
});

test("basic traces and axes and grid and labels and zoom", async ({ page }) => {
  await new SkadiChartTest(page, "chartAxesLabelGridAndZoom")
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .expectLabels({ x: "Time", y: "Value" })
    .expectZoom()
    .end()
});

test("point and axes and zoom", async ({ page }) => {
  await new SkadiChartTest(page, "chartPointsAxesAndZoom")
    .expectNPoints(1000)
    .expectAxes()
    .expectLabels({ x: "Time", y: "Value" })
    .expectZoom()
    .end()
});

test("basic traces and tooltips", async ({ page }) => {
  await new SkadiChartTest(page, "chartTooltips")
    .expectNTraces(10)
    .expectNPoints(1000)
    .expectTooltip()
    .end()
});

test("categorical y axis", async ({ page }) => {
  await new SkadiChartTest(page, "chartCategoricalYAxis")
    .expectNTraces(10)
    .expectNPoints(1000)
    .expectAxes({ x: 1, y: 6 }) // 6 = 5 numerical axes within each band, plus 1 main categorical axis
    .expectTooltip()
    .expectLabels({ x: "Time", y: "Category" })
    .expectGridlines({ x: true, y: false })
    .expectZoom()
    .end();
});

test("categorical x axis", async ({ page }) => {
  await new SkadiChartTest(page, "chartCategoricalXAxis")
    .expectNTraces(10)
    .expectNPoints(1000)
    .expectAxes({ x: 3, y: 1 })
    .expectTooltip()
    .expectLabels({ x: "Category", y: "Value" })
    .expectZoom()
    .end();
});

test("categorical y axis with overlapping bands", async ({ page }) => {
  await new SkadiChartTest(page, "chartOverlappingBandsY")
    .expectNTraces(10)
    .expectAxes({ x: 1, y: 1 }) // Only 1 y axis since tick config count was set to 0.
    .expectTooltip()
    .expectLabels({ x: "Time", y: "Category" })
    .expectZoom()
    .expectClipPath(-100)
    .end();
});

test("custom chart works as expected", async ({ page }) => {
  await new SkadiChartTest(page, "chartCustom")
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .expectLabels({ x: "Time", y: "Value" })
    .expectZoom()
    .expectCustomCircle()
    .end()
});

test("download button works as expected", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Download PNG").click({ force: true });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zoomPlot.png");
});
