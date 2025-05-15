import * as d3 from "@/d3";
import { D3Selection, LayerArgs, LayerType, OptionalLayer, Point, XY, CustomEvents } from "./Layer";
import { TracesLayer } from "./TracesLayer";

export type TooltipHtmlCallback = (point: Point) => string

export class TooltipsLayer extends OptionalLayer {
  type = LayerType.Tooltip;

  constructor(public tooltipHtmlCallback: TooltipHtmlCallback) {
    super();
  };

  private l22 = (coord1: Point, coord2: Point) => {
    const diffX = coord1.x - coord2.x;
    const diffY = coord1.y - coord2.y;
    return diffX * diffX + diffY * diffY;
  };

  private l22Svg = (svgCoord1: Point, svgCoord2: Point, range: XY<number>) => {
    const scaledCoord1: Point = { x: svgCoord1.x / range.x, y: svgCoord1.y / range.y };
    const scaledCoord2: Point = { x: svgCoord2.x / range.x, y: svgCoord2.y / range.y };

    return this.l22(scaledCoord1, scaledCoord2);
  };

  private handleMouseMove = (event: d3.ClientPointEvent, layerArgs: LayerArgs, tooltip: D3Selection<HTMLDivElement>, allPoints: Point[], range: XY<number>) => {
    const [ clientX, clientY ] = d3.pointer(event);
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const coords: Point = { x: scaleX.invert(clientX), y: scaleY.invert(clientY) };

    let minDistance = Infinity;
    const minPoint: Point = allPoints.reduce((minP, p) => {
      const distance = this.l22Svg(coords, p, range);
      if (distance >= minDistance) return minP;
      minDistance = distance;
      return p;
    }, { x: 0, y: 0 });

    const matrix = layerArgs.coreLayers[LayerType.Svg].node()!.getScreenCTM()!;
    const minPointClientCoords = {
      x: (matrix.a * scaleX(minPoint.x)) + (matrix.c * scaleY(minPoint.y)) + matrix.e,
      y: (matrix.b * scaleX(minPoint.x)) + (matrix.d * scaleY(minPoint.y)) + matrix.f
    };

    const clientDistance = this.l22({ x: clientX, y: clientY }, minPointClientCoords);

    if (clientDistance > 700) {
      tooltip.style("opacity", 0);
    } else {
      tooltip.html(this.tooltipHtmlCallback(minPoint))
        .style("left", `${minPointClientCoords.x}px`)
        .style("top", `${minPointClientCoords.y}px`)
        .style("opacity", 1)
    }
  }

  draw = (layerArgs: LayerArgs) => {
    const traceLayers = layerArgs.optionalLayers.filter(l => l.type === LayerType.Trace) as TracesLayer[];
    if (traceLayers.length === 0) {
      console.warn("Tooltip Layer was added without a Traces Layer.");
      return;
    };

    const tooltip = d3.create("div")
      .attr("id", `${layerArgs.getHtmlId(this.type)}`)
      .style("position", "fixed")
      .style("pointer-events", "none") as any as D3Selection<HTMLDivElement>;
    
    const allPoints = traceLayers.reduce((points, layer) => {
      return [...layer.lines.map(l => l.points).flat(), ...points];
    }, [] as Point[]);

    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const rangeX = scaleX.domain()[1] - scaleX.domain()[0];
    const rangeY = scaleY.domain()[1] - scaleY.domain()[0];
    const range = { x: rangeX, y: rangeY };

    const svg = layerArgs.coreLayers[LayerType.Svg];
    let timerFlag: NodeJS.Timeout | undefined = undefined;
    let hideTooltip = false;
    svg.on("mousemove", e => {
      if (timerFlag === undefined && !hideTooltip) {
        // in laggy situation there is a persistent phantom tooltip left behind.
        // this gets rid of any other tooltips that are not meant to be there
        document.querySelectorAll(`#${layerArgs.getHtmlId(this.type)}`)?.forEach(el => el.innerHTML = "");
        this.handleMouseMove(e, layerArgs, tooltip, allPoints, range);
        timerFlag = setTimeout(() => {
          timerFlag = undefined;
        }, 25);
      }
    });

    const hideTooltipCallback = () => {
      hideTooltip = true;
      tooltip.html("");
    };
    const showTooltipCallback = () => {
      hideTooltip = false;
    };

    svg.on(CustomEvents.ZoomStart, hideTooltipCallback);
    svg.on(CustomEvents.ZoomEnd, showTooltipCallback);
    svg.on("mouseleave", () => tooltip.remove());
    svg.on("mouseenter", () => document.body.append(tooltip.node()!));
  };
}
