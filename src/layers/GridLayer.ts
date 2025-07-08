import { D3Selection, LayerArgs } from "@/types";
import { LayerType, OptionalLayer } from "./Layer";

export class GridLayer extends OptionalLayer {
  type = LayerType.Grid;

  constructor() {
    super();
  };

  draw = (layerArgs: LayerArgs) => {
    const { width, height, margin } = layerArgs.bounds;
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const { animationDuration, ticks } = layerArgs.globals;
    const { getHtmlId } = layerArgs;
  
    const gridOpacity = 0.15;
    const gridStrokeWidth = 0.5;

    const addGridX = (g: D3Selection<SVGGElement>) => {
      g.selectAll("line")
        .data(scaleX.ticks(ticks.x))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("x1", (d: number) => scaleX(d))
        .attr("x2", (d: number) => scaleX(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
    };

    const addGridY = (g: D3Selection<SVGGElement>) => {
      g.selectAll("line")
        .data(scaleY.ticks(ticks.y))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", (d: number) => scaleY(d))
        .attr("y2", (d: number) => scaleY(d))
    };

    const gridX = svgLayer.append("g")
      .call(addGridX)
      .attr("opacity", gridOpacity)
      .attr("id", `${getHtmlId(this.type)}-x`);

    const gridY = svgLayer.append("g")
      .call(addGridY)
      .attr("opacity", gridOpacity)
      .attr("id", `${getHtmlId(this.type)}-y`);

    this.zoom = async () => {
      const fadeOutX = gridX.selectAll("line")
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", 0)
        .remove()
        .end();
      const fadeOutY = gridY.selectAll("line")
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", 0)
        .remove()
        .end();
      await Promise.all([fadeOutX, fadeOutY]);

      const fadeInX = gridX.call(addGridX)
        .style("opacity", 0)
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", gridOpacity)
        .end();
      const fadeInY = gridY.call(addGridY)
        .style("opacity", 0)
        .transition()
        .duration(animationDuration / 2)
        .style("opacity", gridOpacity)
        .end();
      await Promise.all([fadeInX, fadeInY]);
    };
  };
}
