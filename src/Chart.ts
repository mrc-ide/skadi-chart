import * as d3 from "./d3";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer } from "./layers/TracesLayer";
import { ZoomLayer } from "./layers/ZoomLayer";
import { TooltipHtmlCallback, TooltipsLayer } from "./layers/TooltipsLayer";
import { AllOptionalLayers, Bounds, D3Selection, LayerArgs, Lines, Point, Scales, XYLabel } from "./types";
import { LayerType } from "./layers/Layer";
import { GridLayer } from "./layers/GridLayer";
import html2canvas from "html2canvas";

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

  constructor(public scales: Scales) {
    this.id = Math.random().toString(26).substring(2, 10);

    return this;
  };

  addAxes = (labels?: XYLabel) => {
    if (labels) {
      if (labels.x) this.defaultMargin.bottom = 60;
      if (labels.y) this.defaultMargin.left = 80;
    }
    this.optionalLayers.push(new AxesLayer(labels || {}));
    return this;
  };

  addGridLines = () => {
    this.optionalLayers.push(new GridLayer());
    return this;
  };

  addTraces = (lines: Lines) => {
    this.optionalLayers.push(new TracesLayer(lines));
    return this;
  };

  addZoom = () => {
    this.optionalLayers.push(new ZoomLayer());
    return this;
  };

  addTooltips = (tooltipHtmlCallback: TooltipHtmlCallback) => {
    this.optionalLayers.push(new TooltipsLayer(tooltipHtmlCallback));
    return this;
  };

  makeResponsive = () => {
    this.isResponsive = true;
    return this;
  };

  private draw = (baseElement: HTMLDivElement, bounds: Bounds) => {
    const getHtmlId = (layer: LayerType[keyof LayerType]) => `${layer}-${this.id}`;
    const { height, width, margin } = bounds;
 
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

    const { x, y } = this.scales;
    const scaleX = d3.scaleLinear()
      .domain([x.start, x.end])
      .range([ margin.left, width - margin.right ]);
    const scaleY = d3.scaleLinear()
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
        scaleExtents: this.scales
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

  appendTo = (baseElement: HTMLDivElement) => {
    const drawWithBounds = (width: number, height: number) => {
      const bounds = { width, height, margin: this.defaultMargin };
      this.draw(baseElement, bounds);
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
