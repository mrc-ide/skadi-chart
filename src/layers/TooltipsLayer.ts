import * as d3 from "@/d3";
import { D3Selection, LayerArgs, LayerType, OptionalLayer, Point, XY, CustomEvents } from "./Layer";
import { TracesLayer } from "./TracesLayer";

export type TooltipHtmlCallback = (point: Point) => string

export class TooltipsLayer extends OptionalLayer {
  type = LayerType.Tooltip;

  constructor(public tooltipHtmlCallback: TooltipHtmlCallback) {
    super();
  };

  // straight line distance squared
  private l22 = (coord1: Point, coord2: Point) => {
    const diffX = coord1.x - coord2.x;
    const diffY = coord1.y - coord2.y;
    return diffX * diffX + diffY * diffY;
  };

  private l22Svg = (svgCoord1: Point, svgCoord2: Point, range: XY<number>) => {
    // we want the closest point based on pixels (how it looks on the user's screen)
    // however if we just calculated the straight line distance between two points
    // without scaling the coords then we would get the closest point if the axes were
    // to scale (i.e. if x axis is [0, 100] and y axis is [0, 700] then the y axis
    // would be 7 times bigger than the x axis).
    //
    // This is not the case as axes may be squished so we need to scale our coordinates
    // to work out a distance that reflect pixel distance between mouse and a point in
    // the data
    const scaledCoord1: Point = { x: svgCoord1.x / range.x, y: svgCoord1.y / range.y };
    const scaledCoord2: Point = { x: svgCoord2.x / range.x, y: svgCoord2.y / range.y };

    return this.l22(scaledCoord1, scaledCoord2);
  };

  private handleMouseMove = (event: d3.ClientPointEvent, layerArgs: LayerArgs, tooltip: D3Selection<HTMLDivElement>, allPoints: Point[], range: XY<number>) => {
    const [ clientX, clientY ] = d3.pointer(event);
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    // convert point from pixel position of mouse to coordinates of the axes
    // in the plot
    const coords: Point = { x: scaleX.invert(clientX), y: scaleY.invert(clientY) };

    let minDistance = Infinity;
    const minPoint: Point = allPoints.reduce((minP, p) => {
      const distance = this.l22Svg(coords, p, range);
      if (distance >= minDistance) return minP;
      minDistance = distance;
      return p;
    }, { x: 0, y: 0 });

    // The minimum point we have calculated is relative to the coordinate system
    // of the svg, however we need absolute coordinates on the page to calculate
    // the actual pixel distance so this matrix transformation does that.
    const matrix = layerArgs.coreLayers[LayerType.Svg].node()!.getScreenCTM()!;
    const minPointClientCoords = {
      x: (matrix.a * scaleX(minPoint.x)) + (matrix.c * scaleY(minPoint.y)) + matrix.e,
      y: (matrix.b * scaleX(minPoint.x)) + (matrix.d * scaleY(minPoint.y)) + matrix.f
    };

    const clientDistance = this.l22({ x: clientX, y: clientY }, minPointClientCoords);

    // the actual straight line distance involves a square root but we don't
    // do a square root for performance reasons so this 700 threshold actually
    // refers to a Math.sqrt(700) pixel threshold which is about 26.5px
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
    if (traceLayers.length === 0) return;

    const tooltip = d3.create("div")
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

    svg.on(CustomEvents.BrushStart, hideTooltipCallback);
    svg.on(CustomEvents.AnimationStart, hideTooltipCallback);
    svg.on(CustomEvents.BrushEnd, showTooltipCallback);
    svg.on(CustomEvents.AnimationEnd, showTooltipCallback);
    svg.on("mouseleave", () => tooltip.remove());
    svg.on("mouseenter", () => document.body.append(tooltip.node()!));
  };
}
