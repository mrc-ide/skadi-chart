import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { D3Selection, LayerArgs, Point, PointWithBand, PointWithMetadata, XY } from "@/types";
import { ScatterLayer } from "./ScatterLayer";

export type TooltipHtmlCallback<Metadata> =
  (pointWithMetadata: PointWithBand<Metadata>, xBandName?: string, yBandName?: string, debugString?: string) => string

// this file uses variable naming conventions that follow the coordinate systems
// section outlined in the README. If DC, SC and CC don't make sense to you please
// read that section first

export class TooltipsLayer<Metadata> extends OptionalLayer {
  type = LayerType.Tooltip;

  constructor(public tooltipHtmlCallback: TooltipHtmlCallback<Metadata>) {
    super();
  };

  // Axis-agnostic function to derive the band name on axis N given a CC on axis N.
  private getBand = (clientSC: number, bandScale?: d3.ScaleBand<string>) => {
    if (!bandScale) {
      return undefined;
    }

    return bandScale.domain().find((currentBand) => {
      const bandStartSC = bandScale(currentBand)!;
      const bandEndSC = bandStartSC + bandScale.bandwidth();
      return clientSC >= bandStartSC && clientSC <= bandEndSC;
    });
  }

  // Axis-agnostic function to derive the start of a band on axis N given a CC on axis N.
  private getBandStartSC = (clientSC: number, bandScale?: d3.ScaleBand<string>) => {
    if (!bandScale) {
      return undefined;
    }

    const band = this.getBand(clientSC, bandScale);
    return band ? bandScale(band) : undefined;
  }

  // Axis-agnostic function to derive the squash factor from a band scale
  // TODO: squashFactor does not take into account any padding between bands
  private getSquashFactor = (bandScale?: d3.ScaleBand<string>) => bandScale?.domain().length ?? 1;

  private getXTranslationSC = (bandScaleX?: d3.ScaleBand<string>, xBand?: string) => {
    if (!bandScaleX) {
      return 0;
    }
    const ridgelineDomain = bandScaleX.domain();
    const bandIndex = ridgelineDomain.findIndex(c => c === xBand);
    return bandIndex * bandScaleX.step();
  }

  private getYTranslationSC = (bandScaleY?: d3.ScaleBand<string>, yBand?: string) => {
    if (!bandScaleY) {
      return 0;
    }
    const yBandIndex = bandScaleY.domain().findIndex(c => c === yBand);
    // Centering 0 within the ridge. TODO: Alternative (for lines with no negative values) would put 0 at bottom of ridge.
    return (((bandScaleY.domain().length - 1) / 2) - yBandIndex) * bandScaleY.step();
  }

  // Converts an x-position in SC to DC, taking into account band scale if it exists
  private getXCoordDC = (
    linearScaleX: d3.ScaleLinear<number, number, never>,
    clientXSC: number,
    bandScaleX?: d3.ScaleBand<string>,
  ) => {
    if (!bandScaleX) {
      // `scale.invert` functions convert SC to DC, whereas applying just `scale` converts from
      // DC to SC
      return linearScaleX.invert(clientXSC)
    }
    // To get DC coordinates from SC coordinates in the case of band scales on the X axis,
    // we must first work out which band we are in. Then we must transform the
    // distance from the band's start coordinates into a _nominal_ x coordinate (SC)
    // _as if the band took the full width of the graph_, so that we can take
    // advantage of the `scale.invert` function on the linear scale to get back to DC.

    const xBandStartSC = this.getBandStartSC(clientXSC, bandScaleX);
    const distanceFromBandStartSC = clientXSC - xBandStartSC!;
    // Undo squashing
    const clientXAsIfFullWidthSC = (distanceFromBandStartSC * this.getSquashFactor(bandScaleX)) + linearScaleX(0);
    return linearScaleX.invert(clientXAsIfFullWidthSC);
  }

  // Converts a y-position in SC to DC, taking into account band scale if it exists
  private getYCoordDC = (
    linearScaleY: d3.ScaleLinear<number, number, never>,
    clientYSC: number,
    bandScaleY?: d3.ScaleBand<string>,
  ) => {
    if (!bandScaleY) {
      // `scale.invert` functions convert SC to DC, whereas applying just `scale` converts from
      // DC to SC
      return linearScaleY.invert(clientYSC)
    }
    // To get DC coordinates from SC coordinates in the case of band scales on the Y axis,
    // we must first work out which band we are in. Then we must transform the
    // distance from the band's zero-line into a _nominal_ distance from the graph's
    // zero-line _as if the band took the full height of the graph_, so that we can take
    // advantage of the `scale.invert` function on the linear scale to get back to DC.

    // This code bakes in the assumption that the zero (DC) line is
    // in the center (SC) of the band / the graph.
    const yBandStartSC = this.getBandStartSC(clientYSC, bandScaleY);
    // Use bandwidth() instead of step() to exclude inter-band padding
    // (Not sure this excludes the pre-band padding but it does exclude post-band padding)
    const bandZeroLineSC = yBandStartSC! + (bandScaleY.bandwidth() / 2);
    const distanceFromBandZeroLineSC = clientYSC - bandZeroLineSC;
    // Undo squashing.
    const distanceFromBandZeroLineAsIfFullHeightSC = distanceFromBandZeroLineSC * this.getSquashFactor(bandScaleY);
    const zeroLineAsIfFullHeightSC = linearScaleY(0);
    const clientYAsIfFullHeightSC = zeroLineAsIfFullHeightSC + distanceFromBandZeroLineAsIfFullHeightSC;
    return linearScaleY.invert(clientYAsIfFullHeightSC);
  }

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
    flatPointsDC: PointWithBand<Metadata>[],
    rangeDC: XY<number>
  ) => {
    // d3.pointer converts coords from CC to SC
    const [clientXSC, clientYSC] = d3.pointer(eventCC);
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const { x: ridgelineScaleX, y: ridgelineScaleY } = layerArgs.scaleConfig.ridgelineScales;

    console.warn("ridgelineScaleX", ridgelineScaleX);

    const xBand = this.getBand(clientXSC, ridgelineScaleX);
    const yBand = this.getBand(clientYSC, ridgelineScaleY);

    const coordsDC = {
      x: this.getXCoordDC(scaleX, clientXSC, ridgelineScaleX),
      y: this.getYCoordDC(scaleY, clientYSC, ridgelineScaleY)
    };

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
    let minPointDC = flatPointsDC
      .filter(({ bands }) => {
        return bands.y === yBand && bands.x === xBand;
      }).reduce((minPDC, pDC) => {
        const distanceSC = this.getFastDistanceSC(coordsDC, pDC, rangeDC);
        if (distanceSC >= fastMinDistanceSC) return minPDC;
        fastMinDistanceSC = distanceSC;
        return pDC;
      }, { x: 0, y: 0, bands: { x: xBand, y: yBand } });

    // scaleY converts DC to SC.
    // SC distance will be the same as pixel distance
    const minPointSC = {
      x: scaleX(
        minPointDC.x / this.getSquashFactor(ridgelineScaleX)
      ) + this.getXTranslationSC(ridgelineScaleX, xBand),
      y: scaleY(
        minPointDC.y / this.getSquashFactor(ridgelineScaleY)
      ) + this.getYTranslationSC(ridgelineScaleY, yBand),
    };
    const minDistanceSC = this.getDistance({ x: clientXSC, y: clientYSC }, minPointSC);

    // if client pointer is more than 25 pixels away from the closest point
    const tooltipRadius = 25;
    if (minDistanceSC > tooltipRadius * tooltipRadius) {
      tooltip.style("opacity", 0);
    } else {
      // Add a circle to the line (for debugging only)
      layerArgs.coreLayers[LayerType.Svg].append("circle")
        .attr("cx", minPointSC.x)
        .attr("cy", minPointSC.y)
        .attr("r", 5)
        .attr("fill", "white")
        .attr("stroke", "black")

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

      const debugString = ``;

      // the tooltip html callback receives the actual data coordinates so the
      // tooltips can be accurate to the user data and we translate the tooltip
      // so it is on top of the closest data point for which we need client
      // coordinates of the point (absolute position of the min point)
      tooltip.html(this.tooltipHtmlCallback(minPointDC, xBand, yBand, debugString))
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
      const layerPointsWithMetadata = layer.ridgelineLinesDC.flatMap(l => {
        return l.points.map(p => ({ ...p, metadata: l.metadata, bands: l.bands }));
      });
      return [...layerPointsWithMetadata, ...pointsWithMetadata];
    }, [] as PointWithBand<Metadata>[]);

    flatPointsDC = scatterLayers.reduce((points, layer) => {
      return [
        ...layer.ridgelinePoints.map(({ x, y, metadata, bands }) => ({ x, y, metadata, bands })),
        ...points,
      ];
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
