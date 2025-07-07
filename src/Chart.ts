import * as d3 from "./d3";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer, TracesOptions } from "./layers/TracesLayer";
import { ZoomLayer, ZoomOptions } from "./layers/ZoomLayer";
import { TooltipHtmlCallback, TooltipsLayer } from "./layers/TooltipsLayer";
import { AllOptionalLayers, Bounds, D3Selection, LayerArgs, Lines, PartialScales, Point, Scales, ScatterPoints, XY, XYLabel } from "./types";
import { LayerType, LifecycleHooks, OptionalLayer } from "./layers/Layer";
import { GridLayer } from "./layers/GridLayer";
import html2canvas from "html2canvas";
import { ScatterLayer } from "./layers/ScatterLayer";

// used for holding custom lifecycle hooks only - layer has no visual effect
class CustomHooksLayer extends OptionalLayer {
  type = LayerType.Custom;
  constructor() { super() };
  draw() {};
}

type ChartOptions = {
  logScale: XY<boolean>
}

type PartialChartOptions = {
  logScale?: Partial<XY<boolean>>
}

export class Chart {
  id: string;
  optionalLayers: AllOptionalLayers[] = [];
  isResponsive: boolean = false;
  globals = {
    animationDuration: 350,
    ticks: { x: 0, y: 0 }
  };
  defaultMargin = { top: 20, bottom: 35, left: 50, right: 20 };
  exportToPng: ((name?: string) => void) | null = null;
  options: ChartOptions;

  constructor(options?: PartialChartOptions) {
    this.options = {
      logScale: {
        x: options?.logScale?.x ?? false,
        y: options?.logScale?.y ?? false
      }
    };
    this.id = Math.random().toString(26).substring(2, 10);

    return this;
  };

  addAxes = (labels: XYLabel = {}) => {
    if (labels.x) this.defaultMargin.bottom = 80;
    if (labels.y) this.defaultMargin.left = 90;
    this.optionalLayers.push(new AxesLayer(labels || {}));
    return this;
  };

  addGridLines = () => {
    this.optionalLayers.push(new GridLayer());
    return this;
  };

  addTraces = (lines: Lines, options?: Partial<TracesOptions>) => {
    const optionsWithDefaults: TracesOptions = {
      RDPEpsilon: options?.RDPEpsilon ?? null
    };
    this.optionalLayers.push(new TracesLayer(lines, optionsWithDefaults));
    return this;
  };

  addZoom = (options?: ZoomOptions) => {
    const optionsWithDefaults: ZoomOptions = {
      lockAxis: options?.lockAxis ?? null
    };
    this.optionalLayers.push(new ZoomLayer(optionsWithDefaults));
    return this;
  };

  addTooltips = (tooltipHtmlCallback: TooltipHtmlCallback) => {
    this.optionalLayers.push(new TooltipsLayer(tooltipHtmlCallback));
    return this;
  };

  addScatterPoints = (points: ScatterPoints) => {
    this.optionalLayers.push(new ScatterLayer(points));
    return this;
  };

  addCustomLifecycleHooks = (lifecycleHooks: Partial<LifecycleHooks>) => {
    const customHooksLayer = new CustomHooksLayer();
    Object.assign(customHooksLayer, lifecycleHooks);
    this.optionalLayers.push(customHooksLayer);
    return this;
  };

  addCustomLayer = (customLayer: OptionalLayer) => {
    this.optionalLayers.push(customLayer);
    return this;
  };

  makeResponsive = () => {
    this.isResponsive = true;
    return this;
  };

  private getXYMinMax = (points: Point[]) => {
    const scales: Scales = {
      x: { start: Infinity, end: -Infinity },
      y: { start: Infinity, end: -Infinity }
    };
    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i];
      if (x < scales.x.start) scales.x.start = x;
      if (x > scales.x.end) scales.x.end = x;
      if (y < scales.y.start) scales.y.start = y;
      if (y > scales.y.end) scales.y.end = y;
    }
    return scales;
  };

  private processScales = (partialScales: PartialScales): Scales => {
    const traceLayers = this.optionalLayers.filter(l => l.type === LayerType.Trace) as TracesLayer[];
    const scatterLayers = this.optionalLayers.filter(l => l.type === LayerType.Scatter) as ScatterLayer[];
    let flatPointsDC = traceLayers.reduce((points, layer) => {
      return [...layer.linesDC.map(l => l.points).flat(), ...points];
    }, [] as Point[]);
    flatPointsDC = scatterLayers.reduce((points, layer) => {
      return [...layer.points.map(p => ({ x: p.x, y: p.y })), ...points];
    }, flatPointsDC);

    const minMax = this.getXYMinMax(flatPointsDC);

    const yPaddingFactor = 1.1;

    return {
      x: {
        start: partialScales.x?.start ?? minMax.x.start,
        end: partialScales.x?.end ?? minMax.x.end,
      },
      y: {
        start: (partialScales.y?.start ?? minMax.y.start) * yPaddingFactor,
        end: (partialScales.y?.end ?? minMax.y.end) * yPaddingFactor,
      },
    };
  };

  private draw = (baseElement: HTMLDivElement, bounds: Bounds, partialScales: PartialScales) => {
    const getHtmlId = (layer: LayerType[keyof LayerType]) => `${layer}-${this.id}`;
    const { height, width, margin } = bounds;
    const scales = this.processScales(partialScales);
 
    const svg = d3.create("svg")
      .attr("id", getHtmlId(LayerType.Svg))
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMinYMin") as any as D3Selection<SVGSVGElement>;

    const clipPath = svg.append("defs")
      .append("svg:clipPath")
      .attr("id", getHtmlId(LayerType.ClipPath)) as any as D3Selection<SVGClipPathElement>;
    clipPath.append("svg:rect")
      .attr("width", width - margin.right - margin.left)
      .attr("height", height - margin.bottom - margin.top)
      .attr("x", margin.left)
      .attr("y", margin.top);

    const baseLayer = svg.append('g')
      .attr("id", getHtmlId(LayerType.BaseLayer))
      .attr("clip-path", `url(#${getHtmlId(LayerType.ClipPath)})`);

    const { x, y } = scales;
    const d3ScaleX = this.options.logScale.x ? d3.scaleLog : d3.scaleLinear;
    const scaleX = d3ScaleX()
      .domain([x.start, x.end])
      .range([ margin.left, width - margin.right ]);
    const d3ScaleY = this.options.logScale.y ? d3.scaleLog : d3.scaleLinear;
    const scaleY = d3ScaleY()
      .domain([y.start, y.end])
      .range([ height - margin.bottom, margin.top ]);
    
    const lineGen = d3.line<Point>()
      .x(d => scaleX(d.x))
      .y(d => scaleY(d.y));

    let ticksX = 10;
    if (width < 500) ticksX = 6;
    if (width < 300) ticksX = 3;
    let ticksY = 10;
    if (height < 400) ticksY = 6;
    if (height < 200) ticksY = 3;

    this.globals.ticks = { x: ticksX, y: ticksY };

    const layerArgs: LayerArgs = {
      id: this.id,
      getHtmlId,
      bounds,
      globals: this.globals,
      scaleConfig: {
        linearScales: { x: scaleX, y: scaleY },
        lineGen,
        scaleExtents: scales
      },
      coreLayers: {
        [LayerType.Svg]: svg,
        [LayerType.ClipPath]: clipPath,
        [LayerType.BaseLayer]: baseLayer
      },
      optionalLayers: this.optionalLayers
    };

    // Clear any existing content in the element
    baseElement.childNodes.forEach(n => n.remove());

    this.optionalLayers.forEach(l => l.draw(layerArgs));

    baseElement.append(layerArgs.coreLayers[LayerType.Svg].node()!);
  };

  appendTo = (baseElement: HTMLDivElement, partialScales: PartialScales = {}) => {
    const drawWithBounds = (width: number, height: number) => {
      const bounds = { width, height, margin: this.defaultMargin };
      this.draw(baseElement, bounds, partialScales);
    };

    const { width, height } = baseElement.getBoundingClientRect();
    drawWithBounds(width, height);

    if (this.isResponsive) {
      // watch for changes in baseElement
      const resizeObserver = new ResizeObserver(entries => {
        const { blockSize: height, inlineSize: width } = entries[0].borderBoxSize[0];
        drawWithBounds(width, height);
      });
      resizeObserver.observe(baseElement);

      // above resizeObserver was not triggering when maximising
      // browser window for example so this event listener watches
      // for changes to the window itself
      window.addEventListener("resize", e => {
        if (!e.view) return;
        const { innerHeight: height, innerWidth: width } = e.view;
        drawWithBounds(width, height);
      });
    }

    this.exportToPng = async (name: string = "graph.png") => {
      const canvas = await html2canvas(baseElement);
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = name;
      link.href = `data:${image}`;
      link.click();
      link.remove();
    }

    return this;
  };
};
