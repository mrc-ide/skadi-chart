import { D3Selection, LayerArgs, XY } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

// `enabled` indicates whether to draw grid lines along the x and/or y axes.
export type GridOptions = { enabled: boolean };

export class GridLayer extends OptionalLayer {
  type = LayerType.Grid;

  constructor(public options: XY<GridOptions>) {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.numericalScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { animationDuration, tickConfig } = layerArgs.globals;
    const { getHtmlId } = layerArgs;

    const gridOpacity = 0.15;
    const gridStrokeWidth = 0.5;
    const grids: Partial<XY<D3Selection<SVGGElement>>> = {};

    const addGridX = (g: D3Selection<SVGGElement>) => {
      g.selectAll("line")
        .data(scaleX.ticks(tickConfig.numerical.x.count))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("pointer-events", "none")
        .attr("x1", (d: number) => scaleX(d))
        .attr("x2", (d: number) => scaleX(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
    };

    const addGridY = (g: D3Selection<SVGGElement>) => {
      g.selectAll("line")
        .data(scaleY.ticks(tickConfig.numerical.y.count))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("pointer-events", "none")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", (d: number) => scaleY(d))
        .attr("y2", (d: number) => scaleY(d))
    };

    if (this.options.x.enabled) {
      grids.x = svgLayer.append("g")
        .call(addGridX)
        .attr("opacity", gridOpacity)
        .attr("id", `${getHtmlId(this.type)}-x`);
    }

    if (this.options.y.enabled) {
      grids.y = svgLayer.append("g")
        .call(addGridY)
        .attr("opacity", gridOpacity)
        .attr("id", `${getHtmlId(this.type)}-y`);
    };

    this.zoom = async () => {
      const fadeOutX = grids.x?.selectAll("line")
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", 0)
        .remove()
        .end();
      const fadeOutY = grids.y?.selectAll("line")
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", 0)
        .remove()
        .end();
      await Promise.all([fadeOutX, fadeOutY]);

      const fadeInX = grids.x?.call(addGridX)
        .style("opacity", 0)
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", gridOpacity)
        .end();
      const fadeInY = grids.y?.call(addGridY)
        .style("opacity", 0)
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", gridOpacity)
        .end();
      await Promise.all([fadeInX, fadeInY]);
    };
  };
}
