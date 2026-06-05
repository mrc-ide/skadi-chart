import { VisualLayer } from "@/Chart/visual/types";
import { XY } from "@/types";
import { test, expect, Page, Locator } from "@playwright/test";

// Tests of new chart interface under src/Chart

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

class NewSkadiChartTest {
  selector: (layerType: VisualLayer, extra?: string) => Promise<Locator[]>;
  tests: Promise<void>[] = [];

  constructor(public page: Page, chartDivId: string) {
    const chartDiv = page.locator(`#${chartDivId}`);

    // The ids we use for elements are of the form
    // `(<extra>-)<layerType>-<randomId>` where <extra>- is
    // optional. We know what layerType we are querying for but
    // getting the randomId is a little trickier, here we just
    // parse the `svg-<randomId>` id of the svg element to
    // obtain the randomId
    this.selector = async (layerType: VisualLayer, extra?: string) => {
      const svgId = await chartDiv.locator("svg").getAttribute("id");
      const [, randomId] = svgId.split("-");
      const id = extra ? `${extra}-${layerType}-${randomId}` : `${layerType}-${randomId}`;
      // this returns any element that partially matches the id
      // and is useful for cases like traces where we have to
      // match `trace-<randomId>-0`, `trace-<randomId>-1`, ...
      // with just `trace-<randomId>`
      return await page.locator(`*[id^="${id}"]`).all();
    };

    return this;
  };

  private addTest = (callback: () => Promise<void>) => {
    this.tests.push(callback());
    return this;
  };

  expectAxes = (numberOfAxes: XY<number> = { x: 1, y: 1 }) => {
    return this.addTest(async () => {
      const xAxis = await this.selector(VisualLayer.Axes, "x");
      expect(xAxis).toHaveLength(numberOfAxes.x);
      const yAxis = await this.selector(VisualLayer.Axes, "y");
      expect(yAxis).toHaveLength(numberOfAxes.y);
    });
  };

  end = async () => {
    for (let i = 0; i < this.tests.length; i++) {
      await this.tests[i];
    }
  };
};

test("chart with categorical x and y axes", async ({ page }) => {
  await new NewSkadiChartTest(page, "categoricalXYAxes")
    .expectAxes({
      x: 4, // 4 = 3 numerical axes (one for each band) plus 1 main categorical axis
      y: 3, // 3 = 2 numerical axes (one for each band) plus 1 main categorical axis
    })
    .end();
});
