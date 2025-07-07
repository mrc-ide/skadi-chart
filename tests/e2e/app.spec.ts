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
      const id = extra ? `${layerType}-${randomId}-${extra}` : `${layerType}-${randomId}`;
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

  expectAxes = () => {
    return this.addTest(async () => {
      const xAxis = await this.selector(LayerType.Axes, "x");
      expect(xAxis).toHaveLength(1);
      const yAxis = await this.selector(LayerType.Axes, "y");
      expect(yAxis).toHaveLength(1);
    });
  };

  expectGridlines = () => {
    return this.addTest(async () => {
      const xGrid = await this.selector(LayerType.Grid, "x");
      expect(xGrid).toHaveLength(1);
      const yGrid = await this.selector(LayerType.Grid, "y");
      expect(yGrid).toHaveLength(1);
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

test("basic traces and tooltips", async ({ page }) => {
  await new SkadiChartTest(page, "chartTooltips")
    .expectNTraces(10)
    .expectTooltip()
    .end()
});

test("download button works as expected", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Download PNG").click({ force: true });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zoomPlot.png");
});
