import { LayerType } from "@/layers/Layer";
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
type Selector = (layerType: LayerType) => Promise<LocatorAndId[]>;

const getLayerTypeSelector = (divSelector: string, page: Page): Selector => {
  const chartDiv = page.locator(`#${divSelector}`);
  return async (layerType: LayerType) => {
    const locators = await chartDiv.locator(`${layerToElement[layerType]}`).all();
    const promises: Promise<string>[] = [];
    locators.map(l => {
      promises.push(l.getAttribute("id"));
    });
    const ids = await Promise.all(promises);

    const locatorsAndIds: { locator: Locator, id: string }[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === null) continue;
      locatorsAndIds.push({ locator: locators[i], id });
    }

    return locatorsAndIds;
  };
};

class SkadiChartTest {
  selector: Selector;
  checks: Promise<void>[] = [];

  constructor(chartDivId: string, page: Page) {
    const chartDiv = page.locator(`#${chartDivId}`);

    this.selector = async (layerType: LayerType) => {
      const locators = await chartDiv.locator(`${layerToElement[layerType]}`).all();
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
      expect(axes.length).toBe(2);

      const isX = !!axes.find(a => a.id.includes("-x"));
      const isY = !!axes.find(a => a.id.includes("-y"));
      expect(isX && isY).toBe(true);
    });
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
    .end()
});

