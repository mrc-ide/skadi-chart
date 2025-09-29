import * as d3 from "./d3";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer, TracesOptions } from "./layers/TracesLayer";
import { ZoomLayer, ZoomOptions } from "./layers/ZoomLayer";
import { TooltipHtmlCallback, TooltipsLayer } from "./layers/TooltipsLayer";
import { AllOptionalLayers, AxisType, Bounds, D3Selection, LayerArgs, Lines, NumericZoomExtents, PartialScales, Point, ScaleNumeric, Scales, ScatterPoints, XY, XYLabel } from "./types";
import { LayerType, LifecycleHooks, OptionalLayer } from "./layers/Layer";
import { GridLayer } from "./layers/GridLayer";
import html2canvas from "html2canvas";
import { ScatterLayer } from "./layers/ScatterLayer";

// used for holding custom lifecycle hooks only - layer has no visual effect
class CustomHooksLayer extends OptionalLayer {
  type = LayerType.Custom;
  constructor() { super() };
  draw() { };
}

export type ChartOptions = {
  logScale: XY<boolean>
}

type PartialChartOptions = {
  logScale?: Partial<XY<boolean>>,
  animationDuration?: number
}

type CategoricalScales = Partial<XY<string[]>>;

export class Chart<Metadata = any> {
  id: string;
  optionalLayers: AllOptionalLayers[] = [];
  isResponsive: boolean = false;
  globals = {
    animationDuration: 350,
    tickConfig: {
      x: { count: 0 },
      y: {
        count: 0,
        specifier: ".2~s", // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
      }
    }
  };
  defaultMargin = { top: 20, bottom: 35, left: 50, right: 20 };
  exportToPng: ((name?: string) => void) | null = null;
  options: ChartOptions;
  autoscaledMaxExtents: Scales = {
    x: { start: -Infinity, end: Infinity },
    y: { start: -Infinity, end: Infinity }
  };

  constructor(options?: PartialChartOptions) {
    this.options = {
      logScale: {
        x: options?.logScale?.x ?? false,
        y: options?.logScale?.y ?? false
      }
    };
    if (options?.animationDuration) {
      this.globals.animationDuration = options.animationDuration;
    }
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

  // Filtering lines is a bit harder than points, if there are points in
  // the line with values <= 0 then you have to split up the line into two line
  // segments, missing out the points with values <= 0. Here we create a line
  // segment and iterate down the points of a line and once we hit a negative
  // coordinate we push that line segment and start a new one
  private filterLinesForLogAxis = (lines: Lines<Metadata>, axis: "x" | "y") => {
    let warningMsg = "";
    const filteredLines: Lines<Metadata> = [];
    for (let i = 0; i < lines.length; i++) {
      const currLine = lines[i];
      let isLastCoordinatePositive = currLine.points[0] && currLine.points[0][axis] > 0;
      let lineSegment: Lines<Metadata>[number] = { ...currLine, points: [], metadata: undefined };

      for (let j = 0; j < currLine.points.length; j++) {
        if (currLine.points[j][axis] <= 0) {
          warningMsg = `You have tried to use ${axis} axis `
            + `log scale but there are traces with `
            + `${axis} coordinates that are <= 0`;
        }

        if (currLine.points[j][axis] > 0) {
          lineSegment.points.push(currLine.points[j]);
          isLastCoordinatePositive = true;
        } else if (isLastCoordinatePositive) {
          filteredLines.push(lineSegment);
          lineSegment = { ...currLine, points: [], metadata: undefined };
          isLastCoordinatePositive = false;
        }
      }

      if (isLastCoordinatePositive) {
        filteredLines.push(lineSegment);
      }
    }
    if (warningMsg) console.warn(warningMsg);
    return filteredLines;
  };

  private filterLines = (lines: Lines<Metadata>) => {
    let filteredLines = lines;
    if (this.options.logScale.x) {
      filteredLines = this.filterLinesForLogAxis(filteredLines, "x");
    }
    if (this.options.logScale.y) {
      filteredLines = this.filterLinesForLogAxis(filteredLines, "y");
    }
    return filteredLines;
  };

  addTraces = (lines: Lines<Metadata>, options?: Partial<TracesOptions>) => {
    const optionsWithDefaults: TracesOptions = {
      RDPEpsilon: options?.RDPEpsilon ?? null
    };
    const filteredLines = this.filterLines(lines);
    this.optionalLayers.push(new TracesLayer(filteredLines, optionsWithDefaults));
    return this;
  };

  addZoom = (options?: ZoomOptions) => {
    const optionsWithDefaults: ZoomOptions = {
      lockAxis: options?.lockAxis ?? null
    };
    this.optionalLayers.push(new ZoomLayer(optionsWithDefaults));
    return this;
  };

  addTooltips = (tooltipHtmlCallback: TooltipHtmlCallback<Metadata>) => {
    this.optionalLayers.push(new TooltipsLayer(tooltipHtmlCallback));
    return this;
  };

  private filterScatterPointsForLogAxis = (points: ScatterPoints<Metadata>, axis: "x" | "y") => {
    const filteredPoints = points.filter(p => p[axis] > 0);
    if (filteredPoints.length !== points.length) {
      console.warn(
        `You have tried to use ${axis} axis `
        + `log scale but there are points with `
        + `${axis} coordinates that are <= 0`
      );
    }
    return filteredPoints;
  };

  private filterScatterPoints = (points: ScatterPoints<Metadata>) => {
    let filteredPoints = points;
    if (this.options.logScale.x) {
      filteredPoints = this.filterScatterPointsForLogAxis(filteredPoints, "x");
    }
    if (this.options.logScale.y) {
      filteredPoints = this.filterScatterPointsForLogAxis(filteredPoints, "y");
    }
    return filteredPoints;
  }

  addScatterPoints = (points: ScatterPoints<Metadata>) => {
    const filteredPoints = this.filterScatterPoints(points);
    this.optionalLayers.push(new ScatterLayer(filteredPoints));
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

  private addLinearPadding = (range: Scales["x"], paddingFactor: number): Scales["x"] => {
    const rangeLinear = Math.abs(range.start - range.end);
    return {
      start: range.start - rangeLinear * paddingFactor,
      end: range.end + rangeLinear * paddingFactor
    };
  };

  private addLogPadding = (range: Scales["x"], paddingFactor: number): Scales["x"] => {
    const startLog = Math.log(range.start);
    const endLog = Math.log(range.end);
    const rangeLog = Math.abs(startLog - endLog);
    return {
      start: Math.exp(startLog - rangeLog * paddingFactor),
      end: Math.exp(endLog + rangeLog * paddingFactor)
    };
  };

  private processScales = (partialScales: PartialScales): Scales => {
    const traceLayers = this.optionalLayers
      .filter(l => l.type === LayerType.Trace) as TracesLayer<Metadata>[];
    const scatterLayers = this.optionalLayers
      .filter(l => l.type === LayerType.Scatter) as ScatterLayer<Metadata>[];
    let flatPointsDC = traceLayers.reduce((points, layer) => {
      return [...layer.linesDC.map(l => l.points).flat(), ...points];
    }, [] as Point[]);
    flatPointsDC = scatterLayers.reduce((points, layer) => {
      return [...layer.points.map(p => ({ x: p.x, y: p.y })), ...points];
    }, flatPointsDC);

    const minMax = this.getXYMinMax(flatPointsDC);
    const paddingFactorX = 0.02;
    const paddingFactorY = 0.03;

    const paddingFuncX = this.options.logScale.x ? this.addLogPadding : this.addLinearPadding;
    const paddingFuncY = this.options.logScale.y ? this.addLogPadding : this.addLinearPadding;

    const paddedX = paddingFuncX(minMax.x, paddingFactorX);
    const paddedY = paddingFuncY(minMax.y, paddingFactorY);

    return {
      x: {
        start: partialScales.x?.start ?? paddedX.start,
        end: partialScales.x?.end ?? paddedX.end
      },
      y: {
        start: partialScales.y?.start ?? paddedY.start,
        end: partialScales.y?.end ?? paddedY.end
      }
    };
  };

  private draw = (
    baseElement: HTMLDivElement,
    bounds: Bounds,
    maxExtents: PartialScales,
    initialExtents: PartialScales,
    categoricalScales: Partial<XY<string[]>> = {},
  ) => {
    const getHtmlId = (layer: LayerType[keyof LayerType]) => `${layer}-${this.id}`;
    const { height, width, margin } = bounds;
    this.autoscaledMaxExtents = this.processScales(maxExtents);

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

    const { x, y } = this.autoscaledMaxExtents;
    const initialDomain: NumericZoomExtents = {
      x: [initialExtents.x?.start ?? x.start, initialExtents.x?.end ?? x.end],
      y: [initialExtents.y?.start ?? y.start, initialExtents.y?.end ?? y.end]
    };
    // Disallow zeros for log-scale domains
    if ((this.options.logScale.x && initialDomain.x.some(bound => bound <= 0))
      || (this.options.logScale.y && initialDomain.y.some(bound => bound <= 0))
    ) {
      throw new Error(`You have tried to use a log scale axis but the initial extents includes 0.`
        + ` Please set the initial extents to a range that does not include 0, or pass {} to try the auto-scale.`
      );
    }

    const rangeX = [margin.left, width - margin.right];
    const rangeY = [height - margin.bottom, margin.top];

    const d3ScaleX = this.options.logScale.x ? d3.scaleLog : d3.scaleLinear;
    const numericalScaleX = d3ScaleX().domain(initialDomain.x).range(rangeX);
    const d3ScaleY = this.options.logScale.y ? d3.scaleLog : d3.scaleLinear;
    const numericalScaleY = d3ScaleY().domain(initialDomain.y).range(rangeY);

    let catScales = {
      x: this.createCategoricalScale(categoricalScales.x, rangeX, numericalScaleX, "x"),
      y: this.createCategoricalScale(categoricalScales.y, rangeY, numericalScaleY, "y"),
    };

    let ticksX = 10;
    if (width < 500) ticksX = 6;
    if (width < 300) ticksX = 3;
    let ticksY = 10;
    if (height < 400) ticksY = 6;
    if (height < 200) ticksY = 3;

    this.globals.tickConfig.x.count = ticksX;
    this.globals.tickConfig.y.count = ticksY;

    const layerArgs: LayerArgs = {
      id: this.id,
      getHtmlId,
      bounds,
      globals: this.globals,
      scaleConfig: {
        linearScales: { x: numericalScaleX, y: numericalScaleY },
        scaleExtents: this.autoscaledMaxExtents,
        categoricalScales: catScales,
      },
      coreLayers: {
        [LayerType.Svg]: svg,
        [LayerType.ClipPath]: clipPath,
        [LayerType.BaseLayer]: baseLayer
      },
      optionalLayers: this.optionalLayers,
      chartOptions: this.options
    };

    // Clear any existing content in the element
    baseElement.childNodes.forEach(n => n.remove());

    this.optionalLayers.forEach(l => l.draw(layerArgs, initialDomain));

    baseElement.append(layerArgs.coreLayers[LayerType.Svg].node()!);
  };

  appendTo = (
    baseElement: HTMLDivElement,
    maxExtents: PartialScales = {},
    initialExtents: PartialScales = {},
    categoricalScales: CategoricalScales = {},
  ) => {
    const drawWithBounds = (width: number, height: number) => {
      const bounds = { width, height, margin: this.defaultMargin };
      this.draw(baseElement, bounds, maxExtents, initialExtents, categoricalScales);
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

  // A categorical scale contains two or more 'bands', which each have a small numerical scale.
  private createCategoricalScale = (
    categories: string[] | undefined,
    range: number[],
    numericalScale: ScaleNumeric,
    axis: AxisType,
  ) => {
    if (!categories?.length) {
      return;
    }
    const bandScale = d3.scaleBand().domain(categories).range(range);
    const bandwidth = bandScale.bandwidth();
    const bands = categories.reduce((acc, category) => {
      const bandStartSC = bandScale(category)!;
      const bandRange = axis === "x"
        ? [bandStartSC, bandStartSC + bandwidth]
        : [bandStartSC + bandwidth, bandStartSC];
      acc[category] = numericalScale.copy().range(bandRange);
      return acc;
    }, {} as Record<string, ScaleNumeric>)
    return { main: bandScale, bands };
  }
};
