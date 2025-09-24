import * as d3 from "@/d3";
import { LayerType, OptionalLayer } from "./Layer";
import { D3Selection, LayerArgs, XY, XYLabel } from "@/types";

export class AxesLayer extends OptionalLayer {
  type = LayerType.Axes;

  // todo - cope with y axes that have a 0 at the bottom of the graph not the middle.

  constructor(public labels: XYLabel) {
    super();
  };

  private drawAxis = (
    axis: 'x' | 'y',
    baseLayer: D3Selection<SVGGElement>,
    svgLayer: D3Selection<SVGSVGElement>,
    layerArgs: LayerArgs,
  ) => {
    const { width, height, margin } = layerArgs.bounds;
    const linearScale = layerArgs.scaleConfig.linearScales[axis];
    const logScale = layerArgs.chartOptions.logScale[axis];
    const ridgelineScale = layerArgs.scaleConfig.ridgelineScales[axis];
    const ticks = layerArgs.globals.ticks[axis];
    const { getHtmlId } = layerArgs;

    // normalisedDirection is a factor to undo the difference in direction between x and y axes
    // (whereby y increases downwards in SC but upwards in DC)
    const normalisedDirection = { x: 1, y: -1 };
    const otherAxis = axis === "x" ? "y" : "x";
    const graphStartingEdgesSC = { x: margin.left, y: margin.top };
    const graphEndingEdgeSC = { x: width - margin.right, y: height - margin.bottom };
    const distanceFromSvgEdgeToAxisSC = { x: margin.bottom, y: margin.left };
    const svgClosestEdgeSC = axis === "x" ? height : 0;

    let zoomableAxis: d3.Axis<d3.NumberValue> | null = null;
    let zoomableAxisLayer: D3Selection<SVGGElement> | null = null;
    let axisLayers: D3Selection<SVGGElement>[] = [];
    let axisLine: D3Selection<SVGLineElement> | null = null;
    const axisConstructor = axis === "x" ? d3.axisBottom : d3.axisLeft;

    const transformTranslate = {
      [axis]: 0,
      [otherAxis]: svgClosestEdgeSC + (normalisedDirection[otherAxis] * distanceFromSvgEdgeToAxisSC[axis]),
    };

    if (false) {
      // DEBUGGING SECTION START
      // draw red dotted line at graphStartingEdgesSC
      baseLayer.append("g").append("line")
        .attr(`${axis}1`, graphStartingEdgesSC[axis])
        .attr(`${axis}2`, graphStartingEdgesSC[axis])
        .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
        .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
        .style("stroke", "red").style("stroke-width", 3)
        .style("stroke-dasharray", ("3, 3"));
      // draw red line at graphEndingEdgeSC
      baseLayer.append("g").append("line")
        .attr(`${axis}1`, graphEndingEdgeSC[axis])
        .attr(`${axis}2`, graphEndingEdgeSC[axis])
        .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
        .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
        .style("stroke", "red").style("stroke-width", 3)
        .style("stroke-dasharray", ("3, 3"));
      // draw blue line at each bandstart and end
      if (ridgelineScale) {
        ridgelineScale.domain().forEach(cat => {
          const bandStartSC = ridgelineScale(cat)!;
          baseLayer.append("g").append("line")
            .attr(`${axis}1`, bandStartSC)
            .attr(`${axis}2`, bandStartSC)
            .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
            .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
            .style("stroke", "blue").style("stroke-width", 3)
            .style("stroke-dasharray", ("3, 3"));
          baseLayer.append("g").append("line")
            .attr(`${axis}1`, bandStartSC + ridgelineScale.bandwidth())
            .attr(`${axis}2`, bandStartSC + ridgelineScale.bandwidth())
            .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
            .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
            .style("stroke", "blue").style("stroke-width", 3)
            .style("stroke-dasharray", ("3, 3"));
        });
      }
      // DEBUGGING SECTION END
    }

    let showZeroLine: boolean;
    const tickSpecifier = axis === "x" ? undefined : (".2~s");
    if (ridgelineScale) {
      const bandwidth = ridgelineScale.bandwidth();
      const showNumericalAxisWithinRidgeline = !ridgelineScale || ridgelineScale.domain().length < 3;
      showZeroLine = !logScale;
      let marginAmountUsedForTickPadding = 0.2;
      if (showZeroLine) { marginAmountUsedForTickPadding = 0.3 };
      if (showNumericalAxisWithinRidgeline) { marginAmountUsedForTickPadding = 0.45 };
      const ridgelineAxis = axisConstructor(ridgelineScale).ticks(ticks).tickSize(0)
        .tickPadding(distanceFromSvgEdgeToAxisSC[axis] * marginAmountUsedForTickPadding);
      axisLayers.push(svgLayer.append("g")
        .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
        .style("font-size", "0.75rem")
        .attr("transform", `translate(${transformTranslate.x},${transformTranslate.y})`)
        .call(ridgelineAxis));

      // Draw a line at [axis]=0 for each band (or the band edges if in log scale - both edges in case of band padding).
      ridgelineScale.domain().forEach(cat => {
        const bandStartSC = ridgelineScale(cat)!;
        // Create a smaller numerical axis within each category.
        const squashedLinearScale = linearScale.copy()
        const rangeExtents = axis === "y" ? [bandStartSC + bandwidth, bandStartSC] : [bandStartSC, bandStartSC + bandwidth];
        squashedLinearScale.range(rangeExtents);
        if (showNumericalAxisWithinRidgeline) {
          const numericalAxis = axisConstructor(squashedLinearScale).ticks(ticks, tickSpecifier).tickSize(0);
          const axisLayer = svgLayer.append("g")
            .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
            .style("font-size", "0.75rem")
            .attr("transform", `translate(${transformTranslate.x},${transformTranslate.y})`)
            .call(numericalAxis);
          // const tickEls = axisLayer.selectAll(".tick");
          // tickEls.filter((_d, i) => i === 0 || i === tickEls.size() - 1).remove();
          axisLayers.push(axisLayer);
        }
        if (showZeroLine) {
          // Draw a line at [axis]=0 for each band
          const usableExtent = graphEndingEdgeSC[axis] - graphStartingEdgesSC[axis];
          const squashFactor = usableExtent / bandwidth; // takes into account any padding in the band scale
          const lineCoordSC = ((linearScale(0) - graphStartingEdgesSC[axis]) / squashFactor) + bandStartSC;
          baseLayer.append("g").append("line")
            .attr(`${axis}1`, lineCoordSC)
            .attr(`${axis}2`, lineCoordSC)
            .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
            .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
            .style("stroke", "black").style("stroke-width", 0.5);

          // Add a tick and label at '0', unless we are elsewhere setting a per-ridge numerical axis
          if (!showNumericalAxisWithinRidgeline) {
            ridgelineScale.domain().forEach(_cat => {
              const numericalAxis = axisConstructor(squashedLinearScale).ticks(1).tickSize(0).tickPadding(6);
              if (transformTranslate.y !== 0) {
                console.error("Transform y must be zero when debugging categorical y axis");
              }
              const axisLayer = svgLayer.append("g")
                .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
                .style("font-size", "0.75rem")
                .attr("transform", `translate(${transformTranslate.x},${transformTranslate.y})`)
                .call(numericalAxis);
              axisLayers.push(axisLayer);
            })
          }
        } else {
          baseLayer.append("g").append("line")
            .attr(`${axis}1`, bandStartSC)
            .attr(`${axis}2`, bandStartSC)
            .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
            .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
            .style("stroke", "black").style("stroke-width", 0.5);
        }
        // Each band may get a line at its end edge too (in case of band padding)
        baseLayer.append("g").append("line")
          .attr(`${axis}1`, bandStartSC + ridgelineScale.bandwidth())
          .attr(`${axis}2`, bandStartSC + ridgelineScale.bandwidth())
          .attr(`${otherAxis}1`, graphEndingEdgeSC[otherAxis])
          .attr(`${otherAxis}2`, graphStartingEdgesSC[otherAxis])
          .style("stroke", "black").style("stroke-width", 0.5);
      });
    } else {
      const numericalAxis = axisConstructor(linearScale).ticks(ticks, tickSpecifier).tickSize(0).tickPadding(12);
      zoomableAxisLayer = svgLayer.append("g")
        .attr("id", `${getHtmlId(LayerType.Axes)}-${axis}`)
        .style("font-size", "0.75rem")
        .attr("transform", `translate(${transformTranslate.x},${transformTranslate.y})`)
        .call(numericalAxis);
      axisLayers.push(zoomableAxisLayer);
      zoomableAxis = numericalAxis;
      if (!logScale) {
        // A line at [axis]=0
        axisLine = baseLayer.append("g").append("line")
          .attr(`${axis}1`, linearScale(0))
          .attr(`${axis}2`, linearScale(0))
          .attr(`${otherAxis}1`, graphStartingEdgesSC[otherAxis])
          .attr(`${otherAxis}2`, graphEndingEdgeSC[otherAxis])
          .style("stroke", "black")
          .style("stroke-width", 0.5);
      }
    }

    axisLayers.forEach(layer => layer.select(".domain").style("stroke-opacity", 0));
    let labelEls: Partial<XY<D3Selection<SVGTextElement>>> = { [axis]: null };

    if (this.labels[axis]) {
      const graphExtentSC = graphEndingEdgeSC[axis] - graphStartingEdgesSC[axis];

      labelEls[axis] = svgLayer.append("text")
        .attr("id", `${getHtmlId(LayerType.Axes)}-label${axis}`)
        .attr("x", normalisedDirection[axis] * (graphExtentSC / 2 + graphStartingEdgesSC[axis]))
        .attr("y", svgClosestEdgeSC + (normalisedDirection[otherAxis] * distanceFromSvgEdgeToAxisSC[axis] / 3))
        .style("font-size", "1.2rem")
        .attr("text-anchor", "middle")
        .text(this.labels[axis])
    }

    labelEls.y?.attr("transform", "rotate(-90)")

    return { zoomableAxisLayer, zoomableAxis, axisLine };
  }

  draw = (layerArgs: LayerArgs) => {
    const { x: scaleX, y: scaleY } = layerArgs.scaleConfig.linearScales;
    const svgLayer = layerArgs.coreLayers[LayerType.Svg];
    const baseLayer = layerArgs.coreLayers[LayerType.BaseLayer];
    const { animationDuration } = layerArgs.globals;

    const axisZoomX = this.drawAxis("x", baseLayer, svgLayer, layerArgs);
    const axisZoomY = this.drawAxis("y", baseLayer, svgLayer, layerArgs);

    // The zoom layer (if added) will update the scaleX and scaleY
    // so axisY and axisX, which are constructed from these, will
    // also update. This function just specifies a smooth transition
    // between the old and new values of the scales
    this.zoom = async () => {
      const promises: Promise<void>[] = [];;
      if (axisZoomX.zoomableAxis && axisZoomX.zoomableAxisLayer) {
        promises.push(axisZoomX.zoomableAxisLayer.transition()
          .duration(animationDuration)
          .call(axisZoomX.zoomableAxis)
          .end());
      }

      if (axisZoomY.zoomableAxis && axisZoomY.zoomableAxisLayer) {
        promises.push(axisZoomY.zoomableAxisLayer.transition()
          .duration(animationDuration)
          .call(axisZoomY.zoomableAxis)
          .end());
      }

      const promiseAxisLineX = axisZoomX.axisLine?.transition()
        .duration(animationDuration)
        .attr("x1", scaleX(0))
        .attr("x2", scaleX(0))
        .end();

      const promiseAxisLineY = axisZoomY.axisLine?.transition()
        .duration(animationDuration)
        .attr("y1", scaleY(0))
        .attr("y2", scaleY(0))
        .end();

      await Promise.all([...promises, promiseAxisLineX, promiseAxisLineY]);
    };
  };
}
