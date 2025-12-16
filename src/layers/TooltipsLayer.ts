import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { AxisType, D3Selection, LayerArgs, Point, PointWithMetadata, XY } from "@/types";
import { ScatterLayer } from "./ScatterLayer";

export type TooltipHtmlCallback<Metadata> =
  (pointWithMetadata: PointWithMetadata<Metadata>) => string

// this file uses variable naming conventions that follow the coordinate systems
// section outlined in the README. If DC, SC and CC don't make sense to you please
// read that section first

export class TooltipsLayer<Metadata> extends OptionalLayer {
  type = LayerType.Tooltip;
  tooltipRadiusSq = 25 * 25;

  // The `distanceAxis` option allows tooltips to calculate the 'closest point' to
  // the cursor based on the point's distance along only one axis.
  // For example, in a histogram or a bar chart you may want to show the tooltip for
  // the nearest x value regardless of y distance.
  constructor(
    public tooltipHtmlCallback: TooltipHtmlCallback<Metadata>,
    public distanceAxis?: "x" | "y",
  ) {
    super();
  };

  // this function returns the straight line distance squared between two points
  // and doesn't care about coordinates since it is just distance so you can give
  // it DC, SC or CC
  private getDistanceSq = (coord1: Point, coord2: Point, axis?: "x" | "y") => {
    const diffX = coord1.x - coord2.x;
    const diffY = coord1.y - coord2.y;
    switch (axis) {
      case "x":
        return diffX * diffX;
      case "y":
        return diffY * diffY;
      default:
        return diffX * diffX + diffY * diffY;
    }
  };

  private getDistanceSqSC = (coord1DC: Point, coord2DC: Point, scalingFactors: XY<number>, axis?: "x" | "y") => {
    const coord1SC = { x: coord1DC.x * scalingFactors.x, y: coord1DC.y * scalingFactors.y };
    const coord2SC = { x: coord2DC.x * scalingFactors.x, y: coord2DC.y * scalingFactors.y };

    return this.getDistanceSq(coord1SC, coord2SC, axis);
  };

  private convertSCPointToCC = (pointSC: Point, layerArgs: LayerArgs) => {
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
      return {
        x: (a * pointSC.x) + (c * pointSC.y) + e,
        y: (b * pointSC.x) + (d * pointSC.y) + f
      };
  };

  private handleMouseMove = (
    eventCC: d3.ClientPointEvent,
    layerArgs: LayerArgs,
    tooltip: D3Selection<HTMLDivElement>,
    flatPointsDC: PointWithMetadata<Metadata>[],
  ) => {
    // d3.pointer converts coords from CC to SC
    const pointer = d3.pointer(eventCC);
    const clientSC = { x: pointer[0], y: pointer[1] };
    const numericalScales = { ...layerArgs.scaleConfig.linearScales };
    const bands = { x: undefined, y: undefined } as Partial<XY<string>>;

    // To get DC coordinates from SC coordinates in the case of band scales,
    // we must first work out which band we are in.
    Object.entries(layerArgs.scaleConfig.categoricalScales).forEach(([axis, catScaleConfig]) => {
      if (catScaleConfig?.bands) {
        const [finalCategory, finalBand] = Object.entries(catScaleConfig.bands).at(-1) || [];
        const ax = axis as AxisType;
        const [band, numScale] = Object.entries(catScaleConfig.bands).find(([category, numericalScale]) => {
          const range = numericalScale.range();
          return clientSC[ax] >= Math.min(...range) && clientSC[ax] <= Math.max(...range);
        }) || [];
        if (band && numScale) {
          numericalScales[ax] = numScale;
          bands[ax] = band;
        } else if (!!finalBand && clientSC[ax] < finalBand.range()[0]) {
          numericalScales[ax] = finalBand || numericalScales[ax];
          bands[ax] = finalCategory;
        }
      }
    });

    // scale.invert functions convert SC to DC, applying just scale converts from
    // DC to SC
    const coordsDC = { x: numericalScales.x.invert(clientSC.x), y: numericalScales.y.invert(clientSC.y) };

    const [plotWidthDC, plotHeightDC] = [numericalScales.x, numericalScales.y].map(s => Math.abs(s.domain()[0] - s.domain()[1]) || 1);
    // plotWidthSC and plotHeightSC give the width and height in pixels of either the overall plot, or of a band within that if applicable.
    // NB these are derived from the original LayerArgs, so will be outdated if the plot has been resized since draw.
    const [plotWidthSC, plotHeightSC] = [numericalScales.x, numericalScales.y].map(s => Math.abs(s.range()[0] - s.range()[1]) || 1);

    // Use scaling factors to normalize DC to account for:
    // 1) the shape of the plot (which might be quite different from 1:1, especially if using categorical axes)
    // 2) different DC scales on x and y axes (including differences due to zooming)
    // Edge case: if divisor is 0, don't do any scaling.
    let scalingFactors = {
      x: plotWidthDC === 0 ? 1 : plotWidthSC / plotWidthDC,
      y: plotHeightDC == 0 ? 1 : plotHeightSC / plotHeightDC,
    };

    // notice that the min point we want is DC because data points are always
    // going to use data coordinates but the minimum distance that we compare
    // is in SC because svg coordinates is what the user sees so you want to
    // pick out the minimum point based on visual distance from the cursor
    // rather than data distance (which can be very different from visual
    // distance if the axes are not the same aspect ratio as the height and
    // width of the svg)
    let minDistanceNormalized = Infinity;
    const minPointDC = flatPointsDC.reduce((minPDC, pDC) => {
      // Only consider points in the band we are in
      if (bands.y !== pDC.bands?.y || bands.x !== pDC.bands?.x) {
        return minPDC;
      }
      const distanceSC = this.getDistanceSqSC(coordsDC, pDC, scalingFactors);
      if (this.distanceAxis) {
        // If using distanceAxis, compare distances along that axis first.
        // If points have equal distance on that axis (as in a stacked bar chart, or a histogram with multiple traces),
        // use full distance to break ties.
        const distanceOnAxisSC = this.getDistanceSqSC(coordsDC, pDC, scalingFactors, this.distanceAxis);
        const minDistanceOnAxisSC = this.getDistanceSqSC(coordsDC, minPDC, scalingFactors, this.distanceAxis);
        if (distanceOnAxisSC > minDistanceOnAxisSC) return minPDC;
      }
      if (distanceSC >= minDistanceNormalized) return minPDC;
      minDistanceNormalized = distanceSC;
      return pDC;
    }, { x: 0, y: 0 });

    // SC distance will be the same as pixel distance
    const minPointSC = { x: numericalScales.x(minPointDC.x), y: numericalScales.y(minPointDC.y) };
    // Having found closest SC point, get its accurate distance to client point
    // to decide if tooltip should be shown
    const minDistanceSC = this.getDistanceSq(clientSC, minPointSC);

    // if client pointer is more than tooltip radius pixels away from the closest point
    // NOTE: we compare the squares of the distance and tooltip radius
    if (minDistanceSC > this.tooltipRadiusSq) {
      tooltip.style("opacity", 0);
    } else {
      const minPointCC = this.convertSCPointToCC(minPointSC, layerArgs);

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
      const layerPointsWithMetadata = layer.linesDC.flatMap(({ points, metadata, bands }) => {
        return points.map(p => ({ ...p, metadata, bands }) );
      });
      return [...layerPointsWithMetadata, ...pointsWithMetadata];
    }, [] as PointWithMetadata<Metadata>[]);
    flatPointsDC = scatterLayers.reduce((points, layer) => ([...layer.points, ...points]), flatPointsDC);

    const svg = layerArgs.coreLayers[LayerType.Svg];
    let timerFlag: NodeJS.Timeout | undefined = undefined;
    let hideTooltip = false;
    svg.on("mousemove", e => {
      if (timerFlag === undefined && !hideTooltip) {
        // in laggy situation there is a persistent phantom tooltip left behind.
        // this gets rid of any other tooltips that are not meant to be there
        document.querySelectorAll(`*[id*="${this.type}"]`)?.forEach(el => el.innerHTML = "");
        this.handleMouseMove(e, layerArgs, tooltip, flatPointsDC);
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
