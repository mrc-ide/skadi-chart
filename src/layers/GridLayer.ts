import { AxisType, D3Selection, LayerArgs, ScaleNumeric, XY } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";
import { axes, numScalesForAxis } from "@/helpers";

// `enabled` indicates whether to draw grid lines along the x and/or y axes.
export type GridOptions = { enabled: boolean };

// Config per set of gridlines. For non-categorical axes, there will be one set per (enabled) axis.
// Categorical axes are composed of 'bands'.
// For each pairwise combination of bands from each categorical axis, there is one gridline set per (enabled) axis.
// E.g. If both axes are categorical with 3 bands each, and the GridLayer is configured to enable gridlines for
// both x and y axes, then there will be 18 total gridlines = 9 sub-plots each with and x and a y set.
type GridlineSet = {
  g: D3Selection<SVGGElement>, // The g-element containing the grid lines
  axis: AxisType, // The axis along which the grid lines run
  scaleA: ScaleNumeric, // The scale on this axis, whose ticks correspond to this set of grid lines
  scaleB: ScaleNumeric, // The relevant scale on the opposite axis, used to determine the start and end points of the grid lines
};

export class GridLayer extends OptionalLayer {
  type = LayerType.Grid;
  animationDuration: number = 0;
  private readonly gridOpacity = 0.15;
  private readonly gridStrokeWidth = 0.5;

  constructor(public options: XY<GridOptions>) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { tickConfig } = layerArgs.globals;
    const { getHtmlId } = layerArgs;
    this.animationDuration = layerArgs.globals.animationDuration;

    // If an axis has multiple numerical axes (i.e. it is categorical with bands), there
    // will be multiple grids and scales for that axis; otherwise just one per axis.
    const gridlineSets: GridlineSet[] = [];

    // A callback to add grid lines to a given grid g-element for a given pair of scales
    const addGrid = ({ g, scaleA, scaleB, axis: axisA }: GridlineSet) => {
      const axisB = axisA === "x" ? "y" : "x";

      g.selectAll("line")
        .data(scaleA.ticks(tickConfig.numerical[axisA].count))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", this.gridStrokeWidth)
        .attr("pointer-events", "none")
        .attr(`${axisA}1`, (d: number) => scaleA(d))
        .attr(`${axisA}2`, (d: number) => scaleA(d))
        .attr(`${axisB}1`, scaleB.range()[0])
        .attr(`${axisB}2`, scaleB.range()[1])
    }

    const setupGridlines = (axisA: AxisType) => {
      const aScales = numScalesForAxis(axisA, layerArgs);
      const bScales = numScalesForAxis(axisA === "x" ? "y" : "x", layerArgs);

      aScales.forEach((scaleA) => {
        bScales.forEach((scaleB) => {
          const config = { scaleA, scaleB, axis: axisA };

          const gridG = svgLayer.append("g")
            .call((g) => addGrid({ g, ...config }))
            .attr("opacity", this.gridOpacity)
            .attr("id", `${axisA}-${getHtmlId(this.type)}`)
          gridlineSets.push({ g: gridG, ...config });
        });
      });
    }

    axes.filter(ax => this.options[ax].enabled).forEach(setupGridlines);

    const fadeInGrid = (gridlineSet: GridlineSet): Promise<void> => {
      return gridlineSet.g.call(() => addGrid(gridlineSet))
        .style("opacity", 0)
        .transition()
        .duration(this.animationDuration / 2)
        .style("opacity", this.gridOpacity)
        .end();
    };

    this.zoom = async () => {
      await Promise.all(gridlineSets.map(this.fadeOutGrid));

      await Promise.all(gridlineSets.map(fadeInGrid));
    };
  };

  private fadeOutGrid = ({ g }: GridlineSet): Promise<void> => {
    return g.selectAll("line")
      .transition()
      .duration(this.animationDuration / 2)
      .style("opacity", 0)
      .remove()
      .end();
  };
}
