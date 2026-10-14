import * as d3 from "@/d3";
import { D3Selection, MixNewFlags } from "@/types";
import {
  CoreLayer,
  CoreLayers,
  DefaultCurrFlags,
  This,
  CurrFlags,
  VisualLayer,
  VisualLayers,
  CurrOutput,
  CurrState,
  PredrawLayer,
  PredrawLayers
} from "./types";
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../config/types";
import { Interactive } from "../interactive/Interactive";
import { AxesLayer } from "./layers/AxesLayer";
import { TracesLayer } from "./layers/TracesLayer";
import { LinesLayer } from "./layers/predraw/LinesLayer";
import { ScalesLayer } from "./layers/predraw/ScalesLayer";
import { ChartType } from "../axes/types";

export class Visual<CType extends ChartType, Flags extends CurrFlags> {
  private coreLayers: CoreLayers;
  private visualLayers: VisualLayers = {
    [VisualLayer.Axes]: null,
    [VisualLayer.Trace]: null,
  };
  private predrawLayers: PredrawLayers = {
    [PredrawLayer.Scales]: null,
    [PredrawLayer.Lines]: null,
  };

  private constructor(private prevOutput: PrevOutput) {
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

    const clipPathBounds = this.prevOutput.baseState.clipPathBounds;
    clipPath.append("svg:rect")
      .attr("width", clipPathBounds.width)
      .attr("height", clipPathBounds.height)
      .attr("x", clipPathBounds.margin.x.start)
      .attr("y", clipPathBounds.margin.y.start);

    const baseLayer = svg.append('g')
      .attr("id", getHtmlId(CoreLayer.BaseLayer))
      .attr("clip-path", `url(#${clipPathId})`) as any as D3Selection<SVGGElement>;

    this.coreLayers = {
      [CoreLayer.Svg]: svg,
      [CoreLayer.ClipPath]: clipPath,
      [CoreLayer.BaseLayer]: baseLayer,
    };

    this.predrawLayers[PredrawLayer.Scales] = new ScalesLayer(this.prevOutput);
    if (this.prevOutput.dataState.lines.length) {
      this.predrawLayers[PredrawLayer.Lines] = new LinesLayer(
        this.prevOutput, this.predrawLayers[PredrawLayer.Scales]
      );
    }
  };

  static start<CType extends ChartType, PFlags extends PrevFlags>(
    prevOutput: PrevOutput
  ) {
    type NewFlags = DefaultCurrFlags<PFlags>
    return new Visual<CType, NewFlags>(prevOutput) as This<CType, NewFlags>
  };

  addAxes() {
    this.visualLayers[VisualLayer.Axes] = new AxesLayer(
      this.prevOutput, this.predrawLayers, this.coreLayers
    );
    return this as This<CType, Flags>;
  };

  addTraces() {
    this.visualLayers[VisualLayer.Trace] = new TracesLayer(
      this.prevOutput, this.coreLayers, this.predrawLayers[PredrawLayer.Lines]!
    );
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<CType, NewFlags>;
  };

  addScatterPoints() {
    // TODO
    type NewFlags = MixNewFlags<CurrFlags, Flags, { hasVisualDataLayer: true }>
    return this as This<CType, NewFlags>;
  };

  startInteractive() {
    const visualState: CurrState = {
      coreLayers: this.coreLayers,
      visualLayers: this.visualLayers,
    };
    const output = {
      ...this.prevOutput,
      visualState,
    } as CurrOutput;
    return Interactive.start<CType, Flags>(output);
  };
}
