import * as d3 from "./d3";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer, TracesOptions } from "./layers/TracesLayer";
import { ZoomLayer, ZoomOptions } from "./layers/ZoomLayer";
import { TooltipHtmlCallback, TooltipsLayer } from "./layers/TooltipsLayer";
import { AllOptionalLayers, Bounds, D3Selection, LayerArgs, Lines, ZoomExtents, PartialScales, Point, Scales, ScatterPoints, XY, XYLabel, ScaleNumeric, AxisType, CategoricalScaleConfig, TickConfig } from "./types";
import { LayerType, LifecycleHooks, OptionalLayer } from "./layers/Layer";
import { GridLayer } from "./layers/GridLayer";
import html2canvas from "html2canvas";
import { ScatterLayer } from "./layers/ScatterLayer";
import { getXYMinMax } from "./helpers";
import { AreaLayer } from "./layers/AreaLayer";

// used for holding custom lifecycle hooks only - layer has no visual effect
class CustomHooksLayer extends OptionalLayer {
  type = LayerType.Custom;
  constructor() { super() };
  draw() {};
}

export type ChartOptions = {
  logScale: XY<boolean>
}

type PartialChartOptions = {
  logScale?: Partial<XY<boolean>>,
  animationDuration?: number,
  bandOverlap?: Partial<XY<number>>,
  bandInnerPadding?: Partial<XY<number>>,
  tickConfig?: Partial<XY<Partial<TickConfig>>>,
}

type CategoricalScales = Partial<XY<string[]>>;

export class Chart<Metadata = any> {
  id: string;
  optionalLayers: AllOptionalLayers[] = [];
  isResponsive: boolean = false;
  globals = {
    animationDuration: 350,
    tickConfig: { x: { count: -1, specifier: "" }, y: { count: -1, specifier: "" } },
    bandPadding: {
      x: 0,
      y: 0,
    },
  };
  defaultMargin = { top: 20, bottom: 35, left: 50, right: 20 };
  exportToPng: ((name?: string) => void) | null = null;
  options: ChartOptions;
  autoscaledMaxExtents: Scales = {
    x: { start: -Infinity, end: Infinity },
    y: { start: -Infinity, end: Infinity }
  };

  constructor(options?: PartialChartOptions) {
    if ((options?.bandInnerPadding?.x && options?.bandOverlap?.x)
      || (options?.bandInnerPadding?.y && options?.bandOverlap?.y)) {
      throw new Error("Cannot set both bandInnerPadding and bandOverlap on the same axis");
    }

    this.options = {
      logScale: {
        x: options?.logScale?.x ?? false,
        y: options?.logScale?.y ?? false
      },
    };
    if (options?.animationDuration) {
      this.globals.animationDuration = options.animationDuration;
    }
    if (options?.tickConfig?.x) {
      this.globals.tickConfig.x = { ...this.globals.tickConfig.x, ...options.tickConfig.x };
    }
    if (options?.tickConfig?.y) {
      this.globals.tickConfig.y = { ...this.globals.tickConfig.y, ...options.tickConfig.y };
    }
    if (options?.bandOverlap) {
      this.globals.bandPadding.x = options.bandOverlap.x === undefined ? 0: -options.bandOverlap.x;
      this.globals.bandPadding.y = options.bandOverlap.y === undefined ? 0: -options.bandOverlap.y;
    }
    if (options?.bandInnerPadding) {
      this.globals.bandPadding.x = options.bandInnerPadding.x === undefined ? 0: options.bandInnerPadding.x;
      this.globals.bandPadding.y = options.bandInnerPadding.y === undefined ? 0: options.bandInnerPadding.y;
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
      let lineSegment: Lines<Metadata>[number] = { ...currLine, points: [] };

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
          lineSegment = { ...currLine, points: [] };
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

  addArea = () => {
    this.optionalLayers.push(new AreaLayer());
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

    const minMax = getXYMinMax(flatPointsDC);
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
    const bandPadding = this.globals.bandPadding;
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
    const initialDomain: ZoomExtents = {
      x: [initialExtents.x?.start ?? x.start, initialExtents.x?.end ?? x.end],
      y: [initialExtents.y?.start ?? y.start, initialExtents.y?.end ?? y.end]
    };
    const disallowZerosForLogScaleDomainsMsg = `You have tried to use a log scale axis but the initial extents includes 0.`
      + `Using automatic scales instead.`
      + ` Please set the initial extents to a range that does not include 0, or pass {} to default to the auto-scale.`
    if (this.options.logScale.x && initialDomain.x.some(bound => bound <= 0)) {
      console.warn(disallowZerosForLogScaleDomainsMsg);
      const { x } = this.processScales({});
      initialDomain.x = [x.start, x.end];
    }
    if (this.options.logScale.y && initialDomain.y.some(bound => bound <= 0)) {
      console.warn(disallowZerosForLogScaleDomainsMsg);
      const { y } = this.processScales({});
      initialDomain.y = [y.start, y.end];
    }

    const rangeX = [margin.left, width - margin.right];
    const rangeY = [height - margin.bottom, margin.top];

    const d3ScaleX = this.options.logScale.x ? d3.scaleLog : d3.scaleLinear;
    const numericalScaleX = d3ScaleX().domain(initialDomain.x).range(rangeX);
    const d3ScaleY = this.options.logScale.y ? d3.scaleLog : d3.scaleLinear;
    const numericalScaleY = d3ScaleY().domain(initialDomain.y).range(rangeY);

    if (this.globals.tickConfig.x.count === -1) {
      let ticksX = 10;
      if (width < 500) ticksX = 6;
      if (width < 300) ticksX = 3;
      if (categoricalScales.x && categoricalScales.x.length) {
        ticksX = 1;
      }
      this.globals.tickConfig.x.count = ticksX;
    }
    if (this.globals.tickConfig.y.count === -1) {
      let ticksY = 10;
      if (height < 400) ticksY = 6;
      if (height < 200) ticksY = 3;
      if (categoricalScales.y && categoricalScales.y.length) {
        ticksY = 1;
      }
      this.globals.tickConfig.y.count = ticksY;
    }

    const defaultTickSpecifier = ".2~s"; // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
    if (this.globals.tickConfig.x.specifier === "") {
      this.globals.tickConfig.x.specifier = defaultTickSpecifier;
    }
    if (this.globals.tickConfig.y.specifier === "") {
      this.globals.tickConfig.y.specifier = defaultTickSpecifier;
    }

    const layerArgs: LayerArgs = {
      id: this.id,
      getHtmlId,
      bounds,
      globals: this.globals,
      scaleConfig: {
        linearScales: { x: numericalScaleX, y: numericalScaleY },
        scaleExtents: this.autoscaledMaxExtents,
        categoricalScales: {
          x: this.createCategoricalScale(categoricalScales.x, rangeX, numericalScaleX, "x", bandPadding.x),
          y: this.createCategoricalScale(categoricalScales.y, rangeY, numericalScaleY, "y", bandPadding.y),
        },
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
    bandPadding: number,
  ): CategoricalScaleConfig | undefined => {
    if (!categories?.length) {
      return;
    }
    const bandScale = d3.scaleBand().domain(categories).range(range).paddingInner(bandPadding);
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
