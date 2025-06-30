import { LayerType } from "@/layers/Layer";
import { XY } from "@/types";
import { test, expect, Page, Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

const layerToElement: Partial<Record<LayerType, string>> = {
  [LayerType.Axes]: "g",
  [LayerType.Zoom]: "g",
  [LayerType.Trace]: "path",
  [LayerType.Grid]: "g",
  [LayerType.Tooltip]: "div",
};

type LocatorAndId = { locator: Locator, id: string };
type Selector = (
  layerType: LayerType,
  selector?: string,
  baseElement?: Locator | Page
) => Promise<LocatorAndId[]>;

class SkadiChartTest {
  selector: Selector;
  checks: Promise<void>[] = [];

  constructor(chartDivId: string, public page: Page) {
    const chartDiv = page.locator(`#${chartDivId}`);

    this.selector = async (
      layerType: LayerType,
      selector: string = layerToElement[layerType],
      baseElement: Locator | Page = chartDiv
    ) => {
      const locators = await baseElement.locator(`${selector}`).all();
      const promises: Promise<string>[] = [];
      locators.map(l => {
        promises.push(l.getAttribute("id"));
      });
      const ids = await Promise.all(promises);

      const locatorsAndIds: { locator: Locator, id: string }[] = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (id === null || !id.includes(layerType)) continue;
        locatorsAndIds.push({ locator: locators[i], id });
      }

      return locatorsAndIds;
    };

    return this;
  };

  expectNTraces = (n: number) => {
    const promise = this.selector(LayerType.Trace).then(traces => {
      expect(traces.length).toBe(n);
    });
    this.checks.push(promise);
    return this;
  };

  expectAxes = () => {
    const promise = this.selector(LayerType.Axes).then(axes => {
      const isX = !!axes.find(a => a.id.includes("-x"));
      const isY = !!axes.find(a => a.id.includes("-y"));
      expect(isX && isY).toBe(true);
    });
    this.checks.push(promise);
    return this;
  };

  expectGridlines = () => {
    const promise = this.selector(LayerType.Grid).then(gridlines => {
      const isX = !!gridlines.find(a => a.id.includes("-x"));
      const isY = !!gridlines.find(a => a.id.includes("-y"));
      expect(isX && isY).toBe(true);
    });
    this.checks.push(promise);
    return this;
  };

  expectLabels = (labels: Partial<XY<string>>) => {
    const promiseFunc = async () => {
      const axes = await this.selector(LayerType.Axes, "text");
      if (labels.x) {
        const label = axes.find(a => a.id.includes("-labelx")).locator;
        await expect(label).toHaveText(labels.x);
      }
      if (labels.y) {
        const label = axes.find(a => a.id.includes("-labely")).locator;
        await expect(label).toHaveText(labels.y);
      }
    };
    const promise = promiseFunc();
    this.checks.push(promise);
    return this;
  };

  expectZoom = () => {
    const promise = this.selector(LayerType.Zoom).then(zoom => {
      expect(zoom.length).toBe(1);
    });
    this.checks.push(promise);
    return this;
  };

  expectTooltip = () => {
    const promiseFunc = async () => {
      const traces = await this.selector(LayerType.Trace);
      // This fails without force because playwright cannot hover
      // over the trace without the svg intercepting the hover. In
      // fact the svg intercepting the hover is how the tooltips work,
      // however to test the tooltips, we need to guarantee we are
      // over a trace so we force a hover on the trace even though it
      // doesn't trigger any events on it.
      await traces[0].locator.hover({ force: true });
      const tooltip = await this.selector(LayerType.Tooltip, layerToElement[LayerType.Tooltip], this.page);
      expect(tooltip.length).toBe(1);
    };
    const promise = promiseFunc();
    this.checks.push(promise);
    return this;
  };

  end = async () => {
    for (let i = 0; i < this.checks.length; i++) {
      await this.checks[i];
    }
  };
};


test("basic traces", async ({ page }) => {
  await new SkadiChartTest("chartSparkLines", page)
    .expectNTraces(10)
    .end()
});

test("basic traces and axes", async ({ page }) => {
  await new SkadiChartTest("chartOnlyAxes", page)
    .expectNTraces(10)
    .expectAxes()
    .end()
});

test("basic traces and axes and grid", async ({ page }) => {
  await new SkadiChartTest("chartAxesAndGrid", page)
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .end()
});

test("basic traces and axes and grid and labels", async ({ page }) => {
  await new SkadiChartTest("chartAxesLabelsAndGrid", page)
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .expectLabels({ x: "Time", y: "Value" })
    .end()
});

test("basic traces and axes and grid and labels and zoom", async ({ page }) => {
  await new SkadiChartTest("chartAxesLabelGridAndZoom", page)
    .expectNTraces(10)
    .expectAxes()
    .expectGridlines()
    .expectLabels({ x: "Time", y: "Value" })
    .expectZoom()
    .end()
});

test("basic traces and tooltips", async ({ page }) => {
  await new SkadiChartTest("chartTooltips", page)
    .expectNTraces(10)
    .expectTooltip()
    .end()
});
