import { AxisType, D3Selection, LayerArgs, ScaleNumeric, XY } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

// `enabled` indicates whether to draw grid lines along the x and/or y axes.
export type GridOptions = { enabled: boolean };
// Config per set of grid lines. There is one set per band per axis.
type GridlineSet = {
  g: D3Selection<SVGGElement>, // The g-element containing the grid lines
  scale: ScaleNumeric, // The scale used for this set of grid lines
};

export class GridLayer extends OptionalLayer {
  type = LayerType.Grid;
  animationDuration: number = 0;
  private readonly gridOpacity = 0.15;
  private readonly gridStrokeWidth = 0.5;

  constructor(public options: XY<GridOptions>) {
    super();
  };

  private fadeOutGrid = ({ g }: GridlineSet): Promise<void> => {
    return g.selectAll("line")
      .transition()
      .duration(this.animationDuration / 2)
      .style("opacity", 0)
      .remove()
      .end();
  };

  private fadeInGrid = (
    { g, scale }: GridlineSet,
    addGridCallback: (args: GridlineSet) => void,
  ): Promise<void> => {
    return g.call(() => addGridCallback({ g, scale }))
      .style("opacity", 0)
      .transition()
      .duration(this.animationDuration / 2)
      .style("opacity", this.gridOpacity)
      .end();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const numericalScales = layerArgs.scaleConfig.numericalScales;
    const categoricalScales = layerArgs.scaleConfig.categoricalScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { tickConfig } = layerArgs.globals;
    const { getHtmlId } = layerArgs;
    this.animationDuration = layerArgs.globals.animationDuration;

    // If an axis has multiple numerical axes (i.e. it is categorical with bands), there
    // will be multiple grids and scales for that axis; otherwise just one per axis.
    const gridSets: XY<GridlineSet[]> = { x: [], y: [] };

    // A function per axis to add grid lines to a given grid g-element for a given scale
    const addGridCallbacks: XY<(args: GridlineSet) => void> = {
      x: ({ g, scale }: GridlineSet) => {
        g.selectAll("line")
          .data(scale.ticks(tickConfig.numerical.x.count))
          .join("line")
          .style("stroke", "black")
          .style("stroke-width", this.gridStrokeWidth)
          .attr("pointer-events", "none")
          .attr("x1", (d: number) => scale(d))
          .attr("x2", (d: number) => scale(d))
          .attr("y1", margin.top)
          .attr("y2", height - margin.bottom)
      },
      y: ({ g, scale }: GridlineSet) => {
        g.selectAll("line")
          .data(scale.ticks(tickConfig.numerical.y.count))
          .join("line")
          .style("stroke", "black")
          .style("stroke-width", this.gridStrokeWidth)
          .attr("pointer-events", "none")
          .attr("x1", margin.left)
          .attr("x2", width - margin.right)
          .attr("y1", (d: number) => scale(d))
          .attr("y2", (d: number) => scale(d))
      },
    };

    const setupGridlines = (axis: AxisType) => {
      if (this.options[axis].enabled) {
        const bandScales = categoricalScales[axis]?.bands;
        const scales = bandScales ? Object.values(bandScales) : [numericalScales[axis]];

        scales.forEach((scale) => {
          const gridG = svgLayer.append("g")
            .call((g) => addGridCallbacks[axis]?.({ g, scale }))
            .attr("opacity", this.gridOpacity)
            .attr("id", `${getHtmlId(this.type)}-${axis}`);
          gridSets[axis].push({ g: gridG, scale });
        });
      };
    }

    setupGridlines("x");
    setupGridlines("y");

    this.zoom = async () => {
      await Promise.all([...gridSets.x, ...gridSets.y].map(this.fadeOutGrid));

      await Promise.all([
        ...gridSets.x.map(gc => this.fadeInGrid(gc, addGridCallbacks.x)),
        ...gridSets.y.map(gc => this.fadeInGrid(gc, addGridCallbacks.y)),
      ]);
    };
  };
}
