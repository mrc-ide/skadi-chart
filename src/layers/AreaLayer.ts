import * as d3 from "@/d3";
import { D3Selection, LayerArgs, LineConfig, Lines, ScaleNumeric, XY, ZoomExtents } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { TracesLayer } from "./TracesLayer";
import { customLineGen } from "@/customLineGen";

export class AreaLayer<Metadata> extends OptionalLayer {
  type = LayerType.Area;
  svgId = "invisibleSvg";

  constructor() { super() };

  draw(layerArgs: LayerArgs, currentExtents: ZoomExtents): void {
    const { maxScales } = layerArgs.scaleConfig;
    const maxZoomExtents: ZoomExtents = {
      x: maxScales.x.domain() as [number, number],
      y: maxScales.y.domain() as [number, number],
    };
    const traceLayers = layerArgs.optionalLayers
      .filter(l => l.type === LayerType.Trace) as TracesLayer<Metadata>[];

    const invisibleSvg = d3.create("svg")
      .attr("id", this.svgId)
      .attr("width", "0")
      .attr("height", "0")
      .attr("viewBox", `0 0 ${layerArgs.bounds.width} ${layerArgs.bounds.height}`)
      .attr("preserveAspectRatio", "xMinYMin") as any as D3Selection<SVGSVGElement>;

    traceLayers.forEach((layer, layerIdx) => {
      layer.linesDC.forEach((line, lineIdx) => {
        if (!line.fillArea) return;

        const lineSC = layer.lowResLinesSC[lineIdx];
        const lineSegmentsSC = customLineGen(lineSC, maxZoomExtents);
        const closedLineSC = this.closeSvgPath(lineSegmentsSC, maxScales);
        invisibleSvg.append("path")
          .attr("id", `invisiblePath-${layerIdx}-${lineIdx}`)
          .attr("d", closedLineSC);
      });
    });
  };

  private closeSvgPath = (lineSegmentsSC: string[], scales: XY<ScaleNumeric>) => {
    // if empty then we need to either fill in box or not
    const yCoordOfXAxisSC = scales.y(0);
    const firstLineSegment = lineSegmentsSC[0];
    // TODO
  };
};
