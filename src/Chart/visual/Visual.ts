import * as d3 from "@/d3";
import { ChartType, D3Selection, MixNewFlags } from "@/types";
import {
    CoreLayer,
  CoreLayers,
  DefaultVisualFlags,
  This,
  VisualFlags,
  VisualLayer,
  VisualLayers,
  VisualOutput,
  VisualState
} from "./types";
import { ConfigFlags, ConfigOutput } from "../config/types";
import { Interactive } from "../interactive/Interactive";
import { AxesLayer } from "./layers/AxesLayer";
import { getInner } from "../start/utils";

export class Visual<M, T extends ChartType, Flags extends VisualFlags> {
  private coreLayers: CoreLayers;
  private visualLayers: VisualLayers<M> = {
    [VisualLayer.Axes]: null
  };

  private constructor(private configOutput: ConfigOutput<M>) {
    const {
      getHtmlId,
      bounds,
    } = configOutput.baseState;

    const svg = d3.create("svg")
      .attr("id", getHtmlId(CoreLayer.Svg))
      .attr("width", bounds.width)
      .attr("height", bounds.height)
      .attr("viewBox", `0 0 ${bounds.width} ${bounds.height}`)
      .attr("style", "overflow: visible;")
      .attr("preserveAspectRatio", "none") as any as D3Selection<SVGSVGElement>;

    const clipPathId = getHtmlId(CoreLayer.ClipPath);
    const clipPath = svg.append("defs")
      .append("svg:clipPath")
      .attr("id", clipPathId) as any as D3Selection<SVGClipPathElement>;
    const { x, y } = getInner(bounds);
    clipPath.append("svg:rect")
      .attr("width", x.end - x.start)
      .attr("height", y.end - y.start)
      .attr("x", x.start)
      .attr("y", y.start);

    const baseLayer = svg.append('g')
      .attr("id", getHtmlId(CoreLayer.BaseLayer))
      .attr("clip-path", `url(#${clipPathId})`) as any as D3Selection<SVGGElement>;

    this.coreLayers = {
      [CoreLayer.Svg]: svg,
      [CoreLayer.ClipPath]: clipPath,
      [CoreLayer.BaseLayer]: baseLayer,
    };
  };

  static start<M, T extends ChartType, PrevFlags extends ConfigFlags>(
    configOutput: ConfigOutput<M>
  ) {
    type NewFlags = DefaultVisualFlags<PrevFlags>
    return new Visual<M, T, NewFlags>(configOutput) as This<M, T, NewFlags>
  };

  addAxes() {
    this.visualLayers[VisualLayer.Axes] = new AxesLayer<M>(
      this.configOutput, this.coreLayers
    );
    return this as This<M, T, Flags>;
  };

  addTraces() {
    // TODO
    type NewFlags = MixNewFlags<VisualFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<M, T, NewFlags>;
  };

  addScatterPoints() {
    // TODO
    type NewFlags = MixNewFlags<VisualFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<M, T, NewFlags>;
  };

  startInteractive() {
    const visualState: VisualState<M> = {
      coreLayers: this.coreLayers,
      visualLayers: this.visualLayers,
    };
    const output = {
      ...this.configOutput,
      visualState,
    } as VisualOutput<M>;
    return Interactive.start<M, T, Flags>(output);
  };
}
