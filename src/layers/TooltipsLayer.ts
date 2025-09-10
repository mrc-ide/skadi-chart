import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { D3Selection, LayerArgs, Point, PointWithMetadata, XY } from "@/types";
import { ScatterLayer } from "./ScatterLayer";

export type TooltipHtmlCallback<Metadata> =
  (pointWithMetadata: PointWithMetadata<Metadata>, bandName?: string) => string

// this file uses variable naming conventions that follow the coordinate systems
// section outlined in the README. If DC, SC and CC don't make sense to you please
// read that section first

export class TooltipsLayer<Metadata> extends OptionalLayer {
  type = LayerType.Tooltip;

  constructor(public tooltipHtmlCallback: TooltipHtmlCallback<Metadata>) {
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
    flatPointsDC: PointWithMetadata<Metadata>[],
    rangeDC: XY<number>
  ) => {
    // d3.pointer converts coords from CC to SC
    const [clientXSC, clientYSC] = d3.pointer(eventCC);
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;

    // To get DC coordinates from SC coordinates in the case of band scales,
    // we must first work out which band we are in. Then we must transform the
    // distance from the band's zero-line into a nominal distance from the graph's
    // zero-line as if the band took the full height of the graph.
    const categoryDomain = layerArgs.scaleConfig.scaleYCategorical.domain();
    const categoriesWithBandStarts = categoryDomain.map(c => {
      return { name: c, startSC: layerArgs.scaleConfig.scaleYCategorical(c) }
    });
    const band = categoriesWithBandStarts.find(band => clientYSC >= band.startSC!);

    // This code bakes in the assumption that the zero (DC) line is in the center (SC) of the band / the graph.
    // Use bandwidth() instead of step() to exclude inter-band padding. (Not sure this excludes the pre-band padding but it does exclude post-band padding)
    const bandZeroLineSC = band?.startSC! + (layerArgs.scaleConfig.scaleYCategorical.bandwidth() / 2);
    const distanceFromBandZeroLineSC = clientYSC - bandZeroLineSC;
    // Undo squashing.
    // TODO: squashFactor does not take into account any padding between bands
    const squashFactor = categoryDomain.length;
    const distanceFromBandZeroLineAsIfFullHeightSC = distanceFromBandZeroLineSC * squashFactor;
    const zeroLineAsIfFullHeightSC = scaleY(0);
    const clientYSCAsIfFullHeight = zeroLineAsIfFullHeightSC + distanceFromBandZeroLineAsIfFullHeightSC;

    console.log("\nclientYSC", clientYSC);
    console.log("bandZeroLineSC", bandZeroLineSC);
    console.log("zeroLineAsIfFullHeightSC", zeroLineAsIfFullHeightSC);

    // scale.invert functions convert SC to DC, applying just scale converts from
    // DC to SC
    const coordsDC = { x: scaleX.invert(clientXSC), y: scaleY.invert(clientYSCAsIfFullHeight) };

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
    const minPointDC = flatPointsDC
      .filter(point => band ? point.metadata?.category! === band.name : true) // Only look for points in the right category
      .reduce((minPDC, pDC) => {
        const distanceSC = this.getFastDistanceSC(coordsDC, pDC, rangeDC);
        if (distanceSC >= fastMinDistanceSC) return minPDC;
        fastMinDistanceSC = distanceSC;
        return pDC;
      }, { x: 0, y: 0 });


    // From TraceLayer:
    const categoryIndex = categoryDomain.findIndex(c => c === band!.name);
    const categoryThickness = layerArgs.scaleConfig.scaleYCategorical.step();
    // Centering 0 within the ridge. TODO: Alternative (for lines with no negative values) would put 0 at bottom of ridge.
    const adjustmentIfCenteringZero = 1;
    const translation = categoryThickness * (categoryIndex + ((adjustmentIfCenteringZero - categoryDomain.length) / 2));


    // scaleY converts DC to SC.
    // SC distance will be the same as pixel distance
    const minPointSC = {
      x: scaleX(minPointDC.x),
      y: scaleY(minPointDC.y / squashFactor) - translation // Solves tooltipRadius check AND positions tooltip correctly on y axis
    };
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
      tooltip.html(this.tooltipHtmlCallback(minPointDC, band?.name))
        .style("left", `${minPointCC.x}px`)
        .style("top", `${minPointCC.y}px`)
        .style("opacity", 1)
    }
  }

  draw = (layerArgs: LayerArgs) => {
    const traceLayers = layerArgs.optionalLayers
      .filter(l => l.type === LayerType.Trace) as TracesLayer<Metadata>[];
    const scatterLayers = layerArgs.optionalLayers
      .filter(l => l.type === LayerType.Scatter) as ScatterLayer<Metadata>[];
    if (traceLayers.length === 0 && scatterLayers.length === 0) {
      console.warn("Tooltip Layer was added without a Traces Layer or a Scatter Layer.");
      return;
    };

    const tooltip = d3.create("div")
      .attr("id", `${layerArgs.getHtmlId(this.type)}`)
      .style("position", "fixed")
      .style("pointer-events", "none") as any as D3Selection<HTMLDivElement>;

    let flatPointsDC = traceLayers.reduce((pointsWithMetadata, layer) => {
      const layerPointsWithMetadata = layer.categoricalLinesDC.flatMap(l => {
        return l.points.map(p => ({ ...p, metadata: l.metadata }));
      });
      return [...layerPointsWithMetadata, ...pointsWithMetadata];
    }, [] as PointWithMetadata<Metadata>[]);

    flatPointsDC = scatterLayers.reduce((points, layer) => {
      return [...layer.points.map(p => ({ x: p.x, y: p.y, metadata: p.metadata })), ...points];
    }, flatPointsDC);

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
        document.querySelectorAll(`*[id*="${this.type}"]`)?.forEach(el => el.innerHTML = "");
        this.handleMouseMove(e, layerArgs, tooltip, flatPointsDC, rangeDC);
        timerFlag = setTimeout(() => {
          timerFlag = undefined;
        }, 25);
      }
    });

    this.brushStart = () => {
      hideTooltip = true;
      tooltip.html("");
    };
    this.afterZoom = () => {
      hideTooltip = false;
    };

    svg.on("mouseleave", () => tooltip.remove());
    svg.on("mouseenter", () => document.body.append(tooltip.node()!));
  };
}
