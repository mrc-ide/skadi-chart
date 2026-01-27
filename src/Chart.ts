import * as d3 from "./d3";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer, TracesOptions } from "./layers/TracesLayer";
import { ZoomLayer, ZoomOptions } from "./layers/ZoomLayer";
import { TooltipHtmlCallback, TooltipsLayer } from "./layers/TooltipsLayer";
import { AllOptionalLayers, Bounds, D3Selection, LayerArgs, Lines, ZoomExtents, PartialScales, Point, Scales, ScatterPoints, XY, XYLabel, ScaleNumeric, AxisType, CategoricalScaleConfig, ClipPathBounds, TickConfig } from "./types";
import { LayerType, LifecycleHooks, OptionalLayer } from "./layers/Layer";
import { GridLayer } from "./layers/GridLayer";
import html2canvas from "html2canvas";
import { ScatterLayer } from "./layers/ScatterLayer";
import { debounce, DebounceConfig, getXYMinMax } from "./helpers";
import { AreaLayer } from "./layers/AreaLayer";

// used for holding custom lifecycle hooks only - layer has no visual effect
class CustomHooksLayer extends OptionalLayer {
  type = LayerType.Custom;
  constructor() { super() };
  draw() {};
}

export type ChartOptions = {
  logScale: XY<boolean>,
  categoricalScalePaddingInner: XY<number>, // Specifies the padding between bands. Must be between 0 and 1. https://d3js.org/d3-scale/band#band_paddingInner
}

type PartialChartOptions = {
  logScale?: Partial<XY<boolean>>,
  animationDuration?: number,
  categoricalScalePaddingInner?: Partial<XY<number>>,
  tickConfig?: {
    numerical?: Partial<XY<Partial<TickConfig<number>>>>,
    categorical?: Partial<XY<Partial<TickConfig<string>>>>,
  },
}

export class Chart<Metadata = any> {
  id: string;
  optionalLayers: AllOptionalLayers[] = [];
  isResponsive: boolean = false;
  globals = {
    animationDuration: 350,
    tickConfig: {
      numerical: {
        x: { specifier: ".2~s" }, // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
        y: { specifier: ".2~s" },
      },
      categorical: { x: {}, y: {} },
    } as LayerArgs["globals"]["tickConfig"],
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
        x: !!options?.logScale?.x,
        y: !!options?.logScale?.y,
      },
      categoricalScalePaddingInner: {
        x: options?.categoricalScalePaddingInner?.x ?? 0,
        y: options?.categoricalScalePaddingInner?.y ?? 0,
      }
    };
    if (options?.animationDuration) {
      this.globals.animationDuration = options.animationDuration;
    }
    if (options?.tickConfig) {
      this.globals.tickConfig = {
        numerical: {
          x: { ...this.globals.tickConfig.numerical.x, ...options.tickConfig.numerical?.x },
          y: { ...this.globals.tickConfig.numerical.y, ...options.tickConfig.numerical?.y },
        },
        categorical: {
          x: { ...this.globals.tickConfig.categorical.x, ...options.tickConfig.categorical?.x },
          y: { ...this.globals.tickConfig.categorical.y, ...options.tickConfig.categorical?.y },
        },
      };
    }
    this.id = Math.random().toString(26).substring(2, 10);

    return this;
  };

  addAxes = (labels: XYLabel = {}, labelPositions?: Partial<XY<number>>) => {
    if (labels.x) this.defaultMargin.bottom = 80;
    if (labels.y) this.defaultMargin.left = 90;
    this.optionalLayers.push(new AxesLayer(
      labels || {},
      {
        x: labelPositions?.x ?? 1/3,
        y: labelPositions?.y ?? 1/3,
      }));
    return this;
  };

  addGridLines = (directions?: Partial<XY<boolean>>) => {
    this.optionalLayers.push(new GridLayer({
      x: directions === undefined ? true : directions.x ?? false,
      y: directions === undefined ? true : directions.y ?? false,
    }));
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

  addTooltips = (tooltipHtmlCallback: TooltipHtmlCallback<Metadata>, radiusPx?: number, distanceAxis?: "x" | "y", ) => {
    this.optionalLayers.push(new TooltipsLayer(tooltipHtmlCallback, radiusPx, distanceAxis));
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

  private appendClipPath = (
    bounds: Bounds,
    clipPathBoundsOptions: ClipPathBounds,
    svg: D3Selection<SVGSVGElement>,
    getHtmlId: (layer: LayerType[keyof LayerType]) => string,
  ) => {
    const clipPathBounds = {
      ...bounds,
      ...clipPathBoundsOptions,
      margin: {
        ...bounds.margin,
        ...clipPathBoundsOptions.margin
      }
    } as Bounds;
    const { width, height, margin } = clipPathBounds;
    const clipPath = svg.append("defs")
      .append("svg:clipPath")
      .attr("id", getHtmlId(LayerType.ClipPath)) as any as D3Selection<SVGClipPathElement>;
    clipPath.append("svg:rect")
      .attr("width", width - margin.right - margin.left)
      .attr("height", height - margin.bottom - margin.top)
      .attr("x", margin.left)
      .attr("y", margin.top);
    return { clipPath, clipPathBounds };
  }

  private draw = (
    baseElement: HTMLDivElement,
    bounds: Bounds,
    maxExtents: PartialScales,
    initialExtents: PartialScales,
    categoricalDomains: Partial<XY<string[]>> = {},
    clipPathBoundsOptions: ClipPathBounds = {},
  ) => {
    const getHtmlId = (layer: LayerType[keyof LayerType]) => `${layer}-${this.id}`;
    const { height, width, margin } = bounds;
    this.autoscaledMaxExtents = this.processScales(maxExtents);
 
    const svg = d3.create("svg")
      .attr("id", getHtmlId(LayerType.Svg))
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("style", "overflow: visible;")
      .attr("preserveAspectRatio", "none") as any as D3Selection<SVGSVGElement>;

    const { clipPath, clipPathBounds } = this.appendClipPath(bounds, clipPathBoundsOptions, svg, getHtmlId);

    const baseLayer = svg.append('g')
      .attr("id", getHtmlId(LayerType.BaseLayer))
      .attr("clip-path", `url(#${getHtmlId(LayerType.ClipPath)})`);

    const { x, y } = this.autoscaledMaxExtents;
    const initialDomain: ZoomExtents = {
      x: [initialExtents.x?.start ?? x.start, initialExtents.x?.end ?? x.end],
      y: [initialExtents.y?.start ?? y.start, initialExtents.y?.end ?? y.end]
    };

    if ((this.options.logScale.x && initialDomain.x.some(bound => bound <= 0))
      || (this.options.logScale.y && initialDomain.y.some(bound => bound <= 0))
    ) {
      throw new Error(`You have tried to use a log scale axis but the initial extents includes 0.`
      + ` Please set the initial extents to a range that does not include 0, or pass {} to default to the auto-scale.`);
    }

    const ranges = {
      x: [margin.left, width - margin.right],
      y: [height - margin.bottom, margin.top]
    } as XY<number[]>;

    const numericalScales = (["x", "y"] as AxisType[]).reduce((acc, axis) => {
      const d3Scale = this.options.logScale[axis] ? d3.scaleLog : d3.scaleLinear;
      acc[axis] = d3Scale().domain(initialDomain[axis]).range(ranges[axis]);
      return acc;
    }, {} as XY<ScaleNumeric>);

    const categoricalScales = (["x", "y"] as AxisType[]).reduce((acc, axis) => {
      acc[axis] = this.createCategoricalScale(
        categoricalDomains[axis],
        ranges[axis],
        numericalScales[axis],
        axis,
        this.options.categoricalScalePaddingInner[axis],
      );
      return acc;
    }, {} as Partial<XY<CategoricalScaleConfig>>);

    // Set some sensible defaults for numerical tick count if not provided in user options
    Object.entries(this.globals.tickConfig.numerical).forEach(([axis, tickConfig]) => {
      const ax = axis as AxisType;
      if (tickConfig.count === undefined) {
        let count = 10;
        if (width < 450) count = 6;
        if (width < 250) count = 3;
        this.globals.tickConfig.numerical[ax].count = count;
      }
    });

    const layerArgs: LayerArgs = {
      id: this.id,
      getHtmlId,
      bounds,
      clipPathBounds: clipPathBounds,
      globals: this.globals,
      scaleConfig: {
        numericalScales,
        scaleExtents: this.autoscaledMaxExtents,
        categoricalScales,
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
    categoricalDomains: Partial<XY<string[]>> = {},
    margins: Partial<Bounds["margin"]> = {},
    clipPathBoundsOptions: ClipPathBounds = {},
  ) => {
    const drawWithBounds = (width: number, height: number) => {
      const bounds = { width, height, margin: { ...this.defaultMargin, ...margins } };
      this.draw(baseElement, bounds, maxExtents, initialExtents, categoricalDomains, clipPathBoundsOptions);
    };

    const { width, height } = baseElement.getBoundingClientRect();
    drawWithBounds(width, height);

    if (this.isResponsive) {
      let debounceConfig: DebounceConfig = {
        timeout: undefined,
        time: 50
      };

      // watch for changes in baseElement
      const resizeObserver = new ResizeObserver(entries => {
        const { blockSize: height, inlineSize: width } = entries[0].borderBoxSize[0];
        debounce(debounceConfig, () => drawWithBounds(width, height));
      });
      resizeObserver.observe(baseElement);

      // above resizeObserver was not triggering when maximising
      // browser window for example so this event listener watches
      // for changes to the window itself
      window.addEventListener("resize", e => {
        if (!e.view) return;
        const { innerHeight: height, innerWidth: width } = e.view;
        debounce(debounceConfig, () => drawWithBounds(width, height));
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
    domain: string[] | undefined,
    range: number[],
    numericalScale: ScaleNumeric,
    axis: AxisType,
    paddingInner: number,
  ): CategoricalScaleConfig | undefined => {
    if (!domain?.length) {
      return;
    }
    const bandScale = d3.scaleBand().domain(domain).range(range).paddingInner(paddingInner);
    const bandwidth = bandScale.bandwidth();
    const bands = domain.reduce((acc, category) => {
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
