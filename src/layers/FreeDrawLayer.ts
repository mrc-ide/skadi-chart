import { D3Selection, LayerArgs, Lines, Point } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import * as d3 from "@/d3";

type DrawnPoint = {
  point: [number, number],
  type: "mousedown" | "mousemove" | "touchstart" | "touchmove"
}

export class FreeDrawLayer<Metadata> extends OptionalLayer {
  type = LayerType.FreeDraw;
  drawCanvas: (baseElement: HTMLDivElement) => void = () => {};
  removeCanvas: () => void = () => {};
  canvas: D3Selection<HTMLCanvasElement> | null = null; 
  addLineToSvg: () => Lines<Metadata> = () => [];
  drawnPoints: DrawnPoint[] = [];

  constructor() {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, margin } = layerArgs.bounds;
    
    this.addLineToSvg = () => {
      const svgLine = d3.line()
        .x(d => d[0])
        .y(d => d[1])
        .curve(d3.curveBasis);

      const lastDrawnPoint = this.drawnPoints[this.drawnPoints.length - 1];
      if (lastDrawnPoint.point[0] !== width - margin.right) {
        const drawnPoint: DrawnPoint = {
          type: "mousedown",
          point: [width - margin.right, lastDrawnPoint.point[1]]
        };
        this.drawnPoints.push(drawnPoint);
      }

      const filteredPoints = this.drawnPoints.map((p, i) => {
        if (p.type === "mousedown" || p.type === "touchstart") return p.point;
        if (i % 10 === 0 || i === this.drawnPoints.length - 1) return p.point;
        return null;
      }).filter(x => x) as [number, number][];

      const path = svgLine(filteredPoints);

      const base = d3.select(`#${layerArgs.getHtmlId(LayerType.BaseLayer)}`)

      const userPath = base.append("path")
        .attr("d", path)
      const node = userPath.node()!;
      const lineLength = node.getTotalLength();
      const numPoints = 1001;
      const interval = lineLength / (numPoints - 1);
      const svgPoints: Point[] = [];
      const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
      for (let i = 0; i < numPoints; i++) {
        const point = node.getPointAtLength(i * interval);
        svgPoints.push({ x: scaleX.invert(point.x), y: scaleY.invert(point.y) });
      }
      userPath.remove();
      const line: Lines<Metadata> = [
        { points: svgPoints, style: { color: "black", strokeDasharray: "10 10" } }
      ];

      this.removeCanvas();
      return line;
    };

    this.removeCanvas = () => {
      document.querySelectorAll(`#${layerArgs.getHtmlId(LayerType.FreeDraw)}`)
        .forEach(x => x.remove());
      this.drawnPoints = [];
    };

    this.drawCanvas = (baseElement: HTMLDivElement) => {
      const { top, left, width, height } = baseElement.getBoundingClientRect()!;
      document.querySelectorAll(`#${layerArgs.getHtmlId(LayerType.FreeDraw)}`)
        .forEach(x => x.remove());
      this.canvas = d3.select("body")
        .append("canvas")
        .attr("id", `${layerArgs.getHtmlId(LayerType.FreeDraw)}`)
        .style("position", "absolute")
        .style("touch-action", "none")
        .style("top", `${top + document.documentElement.scrollTop}px`)
        .style("left", `${left + document.documentElement.scrollLeft}px`)
        .attr("width", width)
        .attr("height", height) as any as D3Selection<HTMLCanvasElement>;
      
      const context = this.canvas.node()!.getContext("2d")!;
      
      const line = d3.line()
        .context(context)
        .x(d => d[0])
        .y(d => d[1])
        .curve(d3.curveBasis)

      let enableDraw = false;

      const draw = () => {
        context.clearRect(0, 0, width, height);
        context.beginPath();
        const filteredPoints = this.drawnPoints.map((p, i) => {
          if (p.type === "mousedown" || p.type === "touchstart") return p.point;
          if (i % 10 === 0 || i === this.drawnPoints.length - 1) return p.point;
          return null;
        }).filter(x => x) as [number, number][];

        line(filteredPoints);

        context.lineWidth = 1;
        context.stroke();
      };

      const addPoint = (event: d3.ClientPointEvent, type: DrawnPoint["type"]) => {
        if (!enableDraw) return;
        const drawnPoint: DrawnPoint = {
          point: d3.pointers(event)[0] as any,
          type
        };

        if (this.drawnPoints.length === 0 && drawnPoint.point[0] !== 0) {
          const startPoint: DrawnPoint = {
            point: [0, drawnPoint.point[1]],
            type: "mousedown"
          };
          this.drawnPoints.push(startPoint);
          this.drawnPoints.push(drawnPoint);
          draw();
        }

        if (this.drawnPoints[this.drawnPoints.length - 1].point[0] >= drawnPoint.point[0]) return;
        this.drawnPoints.push(drawnPoint);
        draw();
      };

      this.canvas.on("touchstart", e => {
        enableDraw = true;
        addPoint(e, "touchstart");
      });
      this.canvas.on("touchmove", e => addPoint(e, "touchmove"));
      this.canvas.on("touchend", () => {
        enableDraw = false;
      });

      this.canvas.on("mousedown", e => {
        enableDraw = true;
        addPoint(e, "mousedown");
      });
      this.canvas.on("mousemove", e => addPoint(e, "mousemove"));
      this.canvas.on("mouseup", () => {
        enableDraw = false;
      });
    };

  };
}
