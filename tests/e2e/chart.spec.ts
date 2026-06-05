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

  selectAxis = async (axis: "x" | "y", categorical = false) =>
    this.selector(VisualLayer.Axes, `${axis}${categorical ? "-categorical" : ""}`);

  expectNumericalAxes = (numberOfAxes: XY<number> = { x: 1, y: 1 }) => {
    return this.addTest(async () => {
      const xAxis = await this.selectAxis("x", false);
      expect(xAxis).toHaveLength(numberOfAxes.x);
      const yAxis = await this.selectAxis("y", false);
      expect(yAxis).toHaveLength(numberOfAxes.y);
    });
  };

  expectCategoricalAxes = (numberOfAxes: XY<number> = { x: 1, y: 1 }) => {
    return this.addTest(async () => {
      const xAxis = await this.selectAxis("x", true);
      expect(xAxis).toHaveLength(numberOfAxes.x);
      const yAxis = await this.selectAxis("y", true);
      expect(yAxis).toHaveLength(numberOfAxes.y);
    });
  };

  expectLabels = (labels: Partial<XY<string>>) => {
    return this.addTest(async () => {
      if (labels.x) {
        const xLabel = await this.selector(VisualLayer.Axes, "x-label");
        await expect(xLabel[0]).toHaveText(labels.x);
      }
      if (labels.y) {
        const yLabel = await this.selector(VisualLayer.Axes, "y-label");
        await expect(yLabel[0]).toHaveText(labels.y);
      }
    });
  };

  expectTicks = (args: Partial<XY<Partial<{ categorical: boolean, text: string[], count: number }>>>) => {
    return this.addTest(async () => {
      if (args.x) {
        const xAxis = await this.selectAxis("x", args.x.categorical);
        const xAxisTicks = xAxis[0].locator(".tick");
        if (args.x.count) {
          await expect(xAxisTicks).toHaveCount(args.x.count);
        }
        if (args.x.text) {
          const tickTexts = await xAxisTicks.locator("text").allTextContents();
          expect(tickTexts).toEqual(args.x.text);
        }
      }
      if (args.y) {
        const yAxis = await this.selectAxis("y", args.y.categorical);
        const yAxisTicks = yAxis[0].locator(".tick");
        if (args.y.count) {
          await expect(yAxisTicks).toHaveCount(args.y.count);
        }
        if (args.y.text) {
          const tickTexts = await yAxisTicks.locator("text").allTextContents();
          expect(tickTexts).toEqual(args.y.text);
        }
      }
    });
  };

  end = async () => {
    for (let i = 0; i < this.tests.length; i++) {
      await this.tests[i];
    }
  };
};

test("chart with numerical axes", async ({ page }) => {
  await new NewSkadiChartTest(page, "numericalAxes")
    .expectNumericalAxes()
    .expectLabels({
      x: "Time",
      y: "Value",
    })
    .end();
});

test("chart with categorical x and y axes", async ({ page }) => {
  await new NewSkadiChartTest(page, "categoricalXYAxes")
    .expectNumericalAxes({ x: 3, y: 2 })
    .expectCategoricalAxes()
    .expectLabels({
      x: "X Category",
      y: "Y Category",
    })
    .expectTicks({
      x: { categorical: true, text: ["A", "B", "C"] },
      y: { categorical: true, text: ["Category A", "Category B"] },
    })
    .end();
});

test("chart with categorical x axis", async ({ page }) => {
  await new NewSkadiChartTest(page, "categoricalXAxis")
    .expectNumericalAxes({ x: 3, y: 1 })
    .expectCategoricalAxes({ x: 1, y: 0 })
    .expectLabels({
      x: "X Category",
      y: "Value",
    })
    .expectTicks({
      x: { categorical: true, text: ["A", "B", "C"] },    })
    .end();
});

test("chart with categorical y axis", async ({ page }) => {
  await new NewSkadiChartTest(page, "categoricalYAxis")
    .expectNumericalAxes({ x: 1, y: 2 })
    .expectCategoricalAxes({ x: 0, y: 1 })
    .expectLabels({
      x: "Time",
      y: "Y Category",
    })
    .expectTicks({
      y: { categorical: true, text: ["Category A", "Category B"] },
    })
    .end();
});
