import * as d3 from "@/d3";
import { ChartType, D3Selection, MixNewFlags } from "@/types";
import {
  CoreLayer,
  CoreLayers,
  DefaultCurrFlags,
  This,
  CurrFlags,
  VisualLayer,
  VisualLayers,
  CurrOutput,
  CurrState
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../config/types";
import { Interactive } from "../interactive/Interactive";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer, TracesOptions } from "./layers/TracesLayer";

export class Visual<M, T extends ChartType, Flags extends CurrFlags> {
  private coreLayers: CoreLayers;
  private visualLayers: VisualLayers<M> = {
    [VisualLayer.Axes]: null,
    [VisualLayer.Trace]: null,
  };

  private constructor(private prevOutput: PrevOutput<M>) {
    const {
      getHtmlId,
      bounds,
    } = prevOutput.baseState;

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

    const { width, height, margin } = this.prevOutput.baseState.clipPathBounds;
    clipPath.append("svg:rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", margin.x.start)
      .attr("y", margin.y.start);

    const baseLayer = svg.append('g')
      .attr("id", getHtmlId(CoreLayer.BaseLayer))
      .attr("clip-path", `url(#${clipPathId})`) as any as D3Selection<SVGGElement>;

    this.coreLayers = {
      [CoreLayer.Svg]: svg,
      [CoreLayer.ClipPath]: clipPath,
      [CoreLayer.BaseLayer]: baseLayer,
    };
  };

  static start<M, T extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput<M>
  ) {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Visual<M, T, NewFlags>(prevOutput) as This<M, T, NewFlags>
  };

  addAxes() {
    this.visualLayers[VisualLayer.Axes] = new AxesLayer<M>(
      this.prevOutput, this.coreLayers
    );
    return this as This<M, T, Flags>;
  };

  // TODO: Check this is the most desirable interface. Could move to Data.ts.
  addTraces(options: TracesOptions = { RDPEpsilon: null }) {
    this.visualLayers[VisualLayer.Trace] = new TracesLayer<M>(
      this.prevOutput, this.coreLayers, options
    );
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<M, T, NewFlags>;
  };

  addScatterPoints() {
    // TODO
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<M, T, NewFlags>;
  };

  startInteractive() {
    const visualState: CurrState<M> = {
      coreLayers: this.coreLayers,
      visualLayers: this.visualLayers,
    };
    const output = {
      ...this.prevOutput,
      visualState,
    } as CurrOutput<M>;
    return Interactive.start<M, T, Flags>(output);
  };
}
