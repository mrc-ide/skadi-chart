import { svgPathProperties } from "svg-path-properties";
import { Chart } from "./Chart";
import * as d3 from "./d3";
import { DrawnPoint, FreeDrawMode, FreeDrawModeConfig } from "./freeDrawModes/mode";
import { smoothMode } from "./freeDrawModes/smooth";
import { LayerType } from "./skadi-chart";
import { Bounds, D3Selection, Scales } from "./types";

export class FreeDraw {
  id: string;
  chartId: string | null = null;
  context: CanvasRenderingContext2D | null = null;
  modeCfg: FreeDrawModeConfig;
  enableDraw: boolean = false;
  drawnPoints: DrawnPoint[] = [];
  bounds: Bounds | null = null;
  baseLayer: D3Selection<SVGGElement> | null = null;

  constructor(public scales: Scales, _mode: FreeDrawMode) {
    this.id = Math.random().toString(26).substring(2, 10);
    this.modeCfg = smoothMode;
    return this;
  };

  private handleMouseMove = (event: d3.ClientPointEvent, type: DrawnPoint["type"]) => {
    if (!this.enableDraw || !this.context || !this.bounds) return;
    const { width, height, margin } = this.bounds;

    const point = d3.pointers(event)[0];
    const inXRange = margin.left <= point[0] && point[0] <= width - margin.right;
    const inYRange = margin.top <= point[1] && point[1] <= height - margin.bottom;
    if (!inXRange || !inYRange) return;

    const drawnPoint: DrawnPoint = { point: d3.pointers(event)[0], type };
    this.drawnPoints = this.modeCfg.processDrawnPoint(drawnPoint, this.drawnPoints);

    const filteredPoints = this.modeCfg.filterDrawnPointsBeforePaint(this.drawnPoints);
    const extrapolatedPoints = this.modeCfg.extrapolate(this.drawnPoints, this.bounds, filteredPoints);
    const canvasLineGen = this.modeCfg.canvasLine(this.context);

    this.context.clearRect(0, 0, width, height);

    this.context.beginPath();
    
    canvasLineGen(extrapolatedPoints);
    this.context.setLineDash([5, 5]);
    this.context.lineWidth = 0.5;

    this.context.stroke();
    
    this.context.beginPath();
    this.context.setLineDash([]);

    canvasLineGen(filteredPoints);

    this.context.lineWidth = 2;
    this.context.stroke();

  };

  drawResponsiveCanvas = (baseElement: HTMLDivElement, callback: any) => {
    this.drawnPoints = [];
    const resizeObserver = new ResizeObserver(entries => {
      const bounds = entries[0].target.getBoundingClientRect();
      this.drawCanvas(baseElement, callback, bounds);

      if (!this.context || !this.bounds) return;
      const filteredPoints = this.modeCfg.filterDrawnPointsBeforePaint(this.drawnPoints);
      const extrapolatedPoints = this.modeCfg.extrapolate(this.drawnPoints, this.bounds, filteredPoints);
      const canvasLineGen = this.modeCfg.canvasLine(this.context);

      this.context.clearRect(0, 0, bounds.width, bounds.height);

      this.context.beginPath();
      
      canvasLineGen(extrapolatedPoints);
      this.context.setLineDash([5, 5]);
      this.context.lineWidth = 0.5;

      this.context.stroke();
      
      this.context.beginPath();
      this.context.setLineDash([]);

      canvasLineGen(filteredPoints);

      this.context.lineWidth = 2;
      this.context.stroke();
    });
    resizeObserver.observe(baseElement);
    // const bounds = baseElement.getBoundingClientRect();
    // this.drawCanvas(baseElement, callback, bounds);
  };

  drawCanvas = (baseElement: HTMLDivElement, callback: any, bounds: any) => {
    const { top, left, width, height } = bounds;
    const chart = new Chart()
      .addAxes()
      .makeResponsive()
      .appendTo(baseElement, this.scales);
    this.baseLayer = chart.baseLayer;
    this.chartId = chart.id;
    const margin = chart.defaultMargin;
    this.bounds = { width, height, margin };

    document.querySelectorAll(`#free-draw-${this.id}`)
      .forEach(x => x.remove());
    console.log({top, left});
    console.log(document.documentElement.scrollTop);
    console.log(document.documentElement.scrollLeft);
    const canvas = d3.select("body")
      .append("canvas")
      .attr("id", `free-draw-${this.id}`)
      .style("position", "absolute")
      .style("touch-action", "none")
      .style("top", `${top + document.documentElement.scrollTop}px`)
      .style("left", `${left + document.documentElement.scrollLeft}px`)
      .attr("width", width)
      .attr("height", height) as any as D3Selection<HTMLCanvasElement>;
    this.context = canvas.node()!.getContext("2d")!;

    this.enableDraw = false;
    canvas.on("touchstart", e => {
      this.enableDraw = true;
      e.preventDefault();
      this.handleMouseMove(e, "touchstart");
      callback();
    });
    canvas.on("touchmove", e => {
      e.preventDefault();
      this.handleMouseMove(e, "touchmove");
      if (this.enableDraw) callback();
    });
    canvas.on("touchend", e => {
      e.preventDefault();
      this.enableDraw = false;
    });

    canvas.on("mousedown", e => {
      this.enableDraw = true;
      e.preventDefault();
      this.handleMouseMove(e, "mousedown");
      callback();
    });
    canvas.on("mousemove", e => {
      e.preventDefault();
      this.handleMouseMove(e, "mousemove");
      if (this.enableDraw) callback();
    });
    canvas.on("mouseup", e => {
      e.preventDefault();
      this.enableDraw = false;
    });
  };

  getPoints = () => {
    if (!this.baseLayer || !this.bounds) return;
  
    const filteredPoints = this.modeCfg.filterDrawnPointsBeforePaint(this.drawnPoints);
    const extrapolatedPoints = this.modeCfg.extrapolate(this.drawnPoints, this.bounds, filteredPoints);
    const path = this.modeCfg.svgLine(extrapolatedPoints);
    const properties = new svgPathProperties(path!);

    const { x, y } = this.scales;
    const { width, height, margin } = this.bounds;
    const scaleX = d3.scaleLinear()
      .domain([ x.start, x.end ])
      .range([ margin.left, width - margin.right ]);
    const scaleY = d3.scaleLinear()
      .domain([ y.start, y.end ])
      .range([ height - margin.bottom, margin.top ]);
    const linearScales = { x: scaleX, y: scaleY };

    const points = this.modeCfg.getPoints(linearScales, properties);

    return points;
  };
};
