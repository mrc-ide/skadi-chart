import * as d3 from "@/d3";
import { JSDOM } from "jsdom";
import { defNumAxis } from "@/Chart/axes/defaults";
import { CurrOutput as ConfigOutput } from "@/Chart/config/types";
import { ZoomLayer } from "@/Chart/interactive/layers/ZoomLayer";
import { LinesLayer } from "@/Chart/visual/layers/predraw/LinesLayer";
import { ScalesLayer } from "@/Chart/visual/layers/predraw/ScalesLayer";
import { TracesLayer } from "@/Chart/visual/layers/TracesLayer";
import { CoreLayer, CoreLayers, PredrawLayer, VisualLayer } from "@/Chart/visual/types";
import { Point } from "@/types";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};

const mouse = (
  target: EventTarget, type: string, x: number, y: number,
  options: MouseEventInit = {},
) => {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    view: document.defaultView,
    clientX: x,
    clientY: y,
    buttons: type === "mouseup" ? 0 : 1,
    ...options,
  }));
};

const setup = () => {
  if (defNumAxis.type !== "numerical") throw new Error("Expected numerical axis defaults");
  const element = document.createElement("div");
  document.body.append(element);
  const bounds = {
    width: 100, height: 100,
    margin: { x: { start: 0, end: 0 }, y: { start: 0, end: 0 } },
  };
  const config: ConfigOutput = {
    baseState: {
      id: "zoom-test", getHtmlId: key => key, element,
      bounds, clipPathBounds: bounds,
    },
    chartCfg: {
      x: { start: [{ ...defNumAxis, domain: [0, 10] }], end: [] },
      y: { start: [{ ...defNumAxis, domain: [0, 10] }], end: [] },
    },
    dataState: {
      lines: [{
        points: [{ x: [1], y: [1] }, { x: [4], y: [4] }],
        style: {},
      }],
      scatterPoints: [],
    },
    configState: { lines: { RDPEpsilon: null } },
  };
  const svg = d3.create("svg").datum<Point>({ x: 0, y: 0 });
  const coreLayers: CoreLayers = {
    [CoreLayer.Svg]: svg,
    [CoreLayer.ClipPath]: svg.append("defs").append("clipPath"),
    [CoreLayer.BaseLayer]: svg.append("g"),
  };
  const scales = new ScalesLayer(config);
  const lines = new LinesLayer(config, scales);
  const traces = new TracesLayer(config, coreLayers, lines);
  traces.draw();
  const animation = deferred();
  const completed = deferred();
  vi.spyOn(traces, "zoom").mockImplementation(() => animation.promise);
  const brushStart = vi.spyOn(lines, "brushStart");
  const beforeZoom = vi.spyOn(lines, "beforeZoom");
  const afterZoom = vi.spyOn(lines, "afterZoom");
  const drawFinalTraces = traces.afterZoom;
  vi.spyOn(traces, "afterZoom").mockImplementation(() => {
    drawFinalTraces();
    completed.resolve();
  });
  new ZoomLayer({
    ...config,
    visualState: {
      coreLayers,
      predrawLayers: {
        [PredrawLayer.Scales]: scales,
        [PredrawLayer.Lines]: lines,
      },
      visualLayers: { [VisualLayer.Axes]: null, [VisualLayer.Trace]: traces },
    },
  }).draw();
  element.append(svg.node()!);
  const brushOverlay = element.querySelector(".overlay")!;
  const preview = svg.node()!.lastElementChild as SVGRectElement;
  const startZoom = () => {
    mouse(brushOverlay, "mousedown", 0, 20);
    mouse(window, "mousemove", 50, 25);
    mouse(window, "mouseup", 50, 25);
    expect(beforeZoom).toHaveBeenCalledTimes(1);
    brushStart.mockClear();
    afterZoom.mockClear();
  };
  const complete = async () => {
    animation.resolve();
    await completed.promise;
  };
  return {
    svg: svg.node()!, brushOverlay, preview, lines,
    brushStart, beforeZoom, afterZoom, startZoom, complete,
  };
};

let dom: JSDOM;

beforeEach(() => {
  // D3 needs a real event.view, not Vitest's synthetic global window.
  dom = new JSDOM("<!DOCTYPE html><body></body>");
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("MouseEvent", dom.window.MouseEvent);
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.window.close();
  vi.unstubAllGlobals();
});

describe("ZoomLayer input during animation", () => {
  test.each(["click", "drag"])("ignores a %s without changing the active tween", async gesture => {
    const f = setup();
    f.startZoom();
    const cachedPoints = f.lines.currLinesSC;
    const tween = f.lines.getNewLineSC(0, 0.5);

    mouse(f.brushOverlay, "mousedown", 20, 20);
    if (gesture === "drag") mouse(window, "mousemove", 80, 80);
    mouse(window, "mouseup", gesture === "drag" ? 80 : 20, gesture === "drag" ? 80 : 20);

    expect(f.brushStart).not.toHaveBeenCalled();
    expect(f.afterZoom).not.toHaveBeenCalled();
    expect(f.beforeZoom).toHaveBeenCalledTimes(1);
    expect(f.preview.style.display).toBe("none");
    expect(f.lines.currLinesSC).toBe(cachedPoints);
    expect(f.lines.getNewLineSC(0, 0.5)).toBe(tween);
    await f.complete();

    mouse(f.brushOverlay, "mousedown", 20, 20);
    mouse(window, "mousemove", 80, 80);
    mouse(window, "mouseup", 80, 80);
    expect(f.beforeZoom).toHaveBeenCalledTimes(2);
  });

  test("does not accept a gesture started while busy even if it ends after zoom", async () => {
    const f = setup();
    f.startZoom();
    mouse(f.brushOverlay, "mousedown", 20, 20);
    await f.complete();
    const cleanupCount = f.afterZoom.mock.calls.length;
    mouse(window, "mousemove", 80, 80);
    mouse(window, "mouseup", 80, 80);

    expect(f.brushStart).not.toHaveBeenCalled();
    expect(f.beforeZoom).toHaveBeenCalledTimes(1);
    expect(f.afterZoom).toHaveBeenCalledTimes(cleanupCount);
    expect(f.preview.style.display).toBe("none");
  });

  test("ignores late brush callbacks when double-click starts zoom mid-gesture", async () => {
    const f = setup();
    mouse(f.brushOverlay, "mousedown", 20, 20);
    mouse(f.svg, "dblclick", 20, 20);
    const cachedPoints = f.lines.currLinesSC;
    mouse(window, "mousemove", 80, 80);
    mouse(window, "mouseup", 80, 80);

    expect(f.beforeZoom).toHaveBeenCalledTimes(1);
    expect(f.afterZoom).not.toHaveBeenCalled();
    expect(f.preview.style.display).toBe("none");
    expect(f.lines.currLinesSC).toBe(cachedPoints);
    await f.complete();
    expect(f.afterZoom).toHaveBeenCalledTimes(1);
  });

  test("preserves idle click cleanup and default mouse filtering", () => {
    const f = setup();
    mouse(f.brushOverlay, "mousedown", 20, 20);
    mouse(window, "mouseup", 20, 20);
    expect(f.brushStart).toHaveBeenCalledTimes(1);
    expect(f.afterZoom).toHaveBeenCalledWith(null);
    expect(f.beforeZoom).not.toHaveBeenCalled();
    f.brushStart.mockClear();
    f.afterZoom.mockClear();

    for (const options of [{ ctrlKey: true }, { button: 2 }]) {
      mouse(f.brushOverlay, "mousedown", 20, 20, options);
      mouse(window, "mousemove", 80, 80, options);
      mouse(window, "mouseup", 80, 80, options);
    }
    expect(f.brushStart).not.toHaveBeenCalled();
    expect(f.afterZoom).not.toHaveBeenCalled();
    expect(f.beforeZoom).not.toHaveBeenCalled();
  });
});
