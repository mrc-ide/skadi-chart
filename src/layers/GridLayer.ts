import { AxisType, D3Selection, LayerArgs, ScaleNumeric, XY } from "@/types";
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
    const { tickConfig } = layerArgs.globals;
    const animationDuration = 2000;
    const { getHtmlId } = layerArgs;

    const gridOpacity = 0.95;
    const gridStrokeWidth = 1.5;
    // If the axis has multiple numerical axes (i.e. it is categorical with bands), there
    // will be multiple grids for that axis; otherwise just one.
    const grids: XY<D3Selection<SVGGElement>[]> = { x: [], y: [] };
    const scales: XY<ScaleNumeric[]> = { x: [], y: [] };

    const addGridX = (g: D3Selection<SVGGElement>, scale: ScaleNumeric) => {
      g.selectAll("line")
        .data(scale.ticks(tickConfig.numerical.x.count))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("pointer-events", "none")
        .attr("x1", (d: number) => scale(d))
        .attr("x2", (d: number) => scale(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
    };

    const addGridY = (g: D3Selection<SVGGElement>, scale: ScaleNumeric) => {
      g.selectAll("line")
        .data(scale.ticks(tickConfig.numerical.y.count))
        .join("line")
        .style("stroke", "black")
        .style("stroke-width", gridStrokeWidth)
        .attr("pointer-events", "none")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", (d: number) => scale(d))
        .attr("y2", (d: number) => scale(d))
    };

    if (this.options.x.enabled) {
      const bandScales = Object.values(layerArgs.scaleConfig.categoricalScales.x?.bands ?? {});
      scales.x = bandScales.length ? bandScales : [scaleX];

      grids.x = scales.x.flatMap((scale) => {
        return svgLayer.append("g")
          .call((g) => addGridX(g, scale))
          .attr("opacity", gridOpacity)
          .attr("id", `${getHtmlId(this.type)}-x`);
      });
    }

    if (this.options.y.enabled) {
      const bandScales = Object.values(layerArgs.scaleConfig.categoricalScales.y?.bands ?? {});
      scales.y = bandScales.length ? bandScales : [scaleY];

      grids.y = scales.y.flatMap((scale) => {
        return svgLayer.append("g")
          .call((g) => addGridY(g, scale))
          .attr("opacity", gridOpacity)
          .attr("id", `${getHtmlId(this.type)}-y`);
      });
    };

    this.zoom = async () => {
      const { x: zoomedScaleX, y: zoomedScaleY } = layerArgs.scaleConfig.numericalScales;
      // nb I think currently we do not update the categorical band numerical scales on zoom, since we disable zoom on categorical axes.
      const bandScalesX = Object.values(layerArgs.scaleConfig.categoricalScales.x?.bands ?? {});
      scales.x = bandScalesX.length ? bandScalesX : [zoomedScaleX];
      const bandScalesY = Object.values(layerArgs.scaleConfig.categoricalScales.y?.bands ?? {});
      scales.y = bandScalesY.length ? bandScalesY : [zoomedScaleY];

      const fadeOutGrid = (g: D3Selection<SVGGElement>): Promise<void> => {
        return g.selectAll("line")
          .transition()
          .duration(animationDuration / 2)
          .style("opacity", 0)
          .remove()
          .end();
      };
      const fadeOutPromises = (grids.x.concat(grids.y)).map(fadeOutGrid);
      await Promise.all(fadeOutPromises ?? []);

      const fadeInGrid = (axis: AxisType): Promise<void>[] => {
        const addGrid = axis === "x" ? addGridX : addGridY;
        return (grids[axis]).map((g, index) => {
          const scale = scales[axis][index];
          return g.call((g) => addGrid(g, scale))
            .style("opacity", 0)
            .transition()
            .duration(animationDuration / 2)
            .style("opacity", gridOpacity)
            .end();
        });
      };
      await Promise.all((["x", "y"] as AxisType[]).flatMap(fadeInGrid));
    };
  };
}
