import * as d3 from "@/d3";
import { LayerType, OptionalLayer, CustomEvents } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { D3Selection, LayerArgs, Point, XY } from "@/types";

export type TooltipHtmlCallback = (point: Point) => string

// this file uses variable naming conventions that follow the coordinate systems
// section outlined in the README. If DC, SC and CC don't make sense to you please
// read that section first

export class TooltipsLayer extends OptionalLayer {
  type = LayerType.Tooltip;

  constructor(public tooltipHtmlCallback: TooltipHtmlCallback) {
    super();
  };

  // this function returns the straight line distance squared between two points
  // and doesn't care about coordinates since it is just distance so you can give
  // it DC, SC or CC
  private getDistance = (coord1: Point, coord2: Point) => {
    const diffX = coord1.x - coord2.x;
    const diffY = coord1.y - coord2.y;
    return diffX * diffX + diffY * diffY;
  };

  private getFastDistanceSC = (coord1DC: Point, coord2DC: Point, rangeDC: XY<number>) => {
    // we want the closest point based on pixels (SC) however if we just calculated
    // the straight line distance between two points (DC) without scaling the coords
    // then we would get the closest point if the axes were to scale. However if the
    // svg was square and x axis extent was [0, 100], while y axis was [0, 1000], then
    // one vertial pixel (SC) will account for 10 times the data distance (DC) as one
    // horizontal pixel so we must scale by the range to get an accurate SC distance
    // representation
    const coord1SC = { x: coord1DC.x / rangeDC.x, y: coord1DC.y / rangeDC.y };
    const coord2SC = { x: coord2DC.x / rangeDC.x, y: coord2DC.y / rangeDC.y };

    return this.getDistance(coord1SC, coord2SC);
  };

  private handleMouseMove = (
    eventCC: d3.ClientPointEvent,
    layerArgs: LayerArgs,
    tooltip: D3Selection<HTMLDivElement>,
    flatPointsDC: Point[],
    rangeDC: XY<number>
  ) => {
    // d3.pointer converts coords from CC to SC
    const [ clientXSC, clientYSC ] = d3.pointer(eventCC);
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;

    // scale.invert functions convert SC to DC, applying just scale converts from
    // DC to SC
    const coordsDC = { x: scaleX.invert(clientXSC), y: scaleY.invert(clientYSC) };

    // notice that the min point we want is DC because data points are always
    // going to use data coordinates but the minimum distance that we compare
    // is in SC because svg coordinates is what the user sees so you want to
    // pick out the minimum point based on visual distance from the cursor
    // rather than data distance (which can be very different from visual
    // distance if the axes are not the same aspect ratio as the height and
    // width of the svg)
    //
    // NOTE: minDistanceSC is not the actual SC distance, we use a crude way
    // to calculate it quickly, it is going to be off by a scale factor. If
    // we wanted to calculate the actual SC distance we would first need to
    // convert DC to SC by using the scaleX and scaleY d3 functions however
    // these are slow so we use our getFastDistanceSC function to quickly
    // compute a proportional distance since we only care about the minimum
    // point
    let fastMinDistanceSC = Infinity;
    const minPointDC = flatPointsDC.reduce((minPDC, pDC) => {
      const distanceSC = this.getFastDistanceSC(coordsDC, pDC, rangeDC);
      if (distanceSC >= fastMinDistanceSC) return minPDC;
      fastMinDistanceSC = distanceSC;
      return pDC;
    }, { x: 0, y: 0 });

    // SC distance will be the same as pixel distance
    const minPointSC = { x: scaleX(minPointDC.x), y: scaleY(minPointDC.y) };
    const minDistanceSC = this.getDistance({ x: clientXSC, y: clientYSC }, minPointSC);

    // if client pointer is more than 25 pixels away from the closest point
    const tooltipRadius = 25;
    if (minDistanceSC > tooltipRadius * tooltipRadius) {
      tooltip.style("opacity", 0);
    } else {
      const funcSCtoCC = layerArgs.coreLayers[LayerType.Svg].node()!.getScreenCTM()!;
      // these equations represent a matrix multiplication + offset vector
      // 
      // [ a, c ][ x ]  +  [ e ]
      // [ b, d ][ y ]     [ f ]
      const {
        a, c,
        b, d
      } = funcSCtoCC;
      const {
        e,
        f
      } = funcSCtoCC;
      const minPointCC = {
        x: (a * minPointSC.x) + (c * minPointSC.y) + e,
        y: (b * minPointSC.x) + (d * minPointSC.y) + f
      };

      // the tooltip html callback receives the actual data coordinates so the
      // tooltips can be accurate to the user data and we translate the tooltip
      // so it is on top of the closest data point for which we need client
      // coordinates of the point (absolute position of the min point)
      tooltip.html(this.tooltipHtmlCallback(minPointDC))
        .style("left", `${minPointCC.x}px`)
        .style("top", `${minPointCC.y}px`)
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
    
    const flatPointsDC = traceLayers.reduce((points, layer) => {
      return [...layer.lines.map(l => l.points).flat(), ...points];
    }, [] as Point[]);

    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const rangeXDC = scaleX.domain()[1] - scaleX.domain()[0];
    const rangeYDC = scaleY.domain()[1] - scaleY.domain()[0];
    const rangeDC = { x: rangeXDC, y: rangeYDC };

    const svg = layerArgs.coreLayers[LayerType.Svg];
    let timerFlag: NodeJS.Timeout | undefined = undefined;
    let hideTooltip = false;
    svg.on("mousemove", e => {
      if (timerFlag === undefined && !hideTooltip) {
        // in laggy situation there is a persistent phantom tooltip left behind.
        // this gets rid of any other tooltips that are not meant to be there
        document.querySelectorAll(`#${layerArgs.getHtmlId(this.type)}`)?.forEach(el => el.innerHTML = "");
        this.handleMouseMove(e, layerArgs, tooltip, flatPointsDC, rangeDC);
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
