import { AxisUtil } from "@/helpers";
import { D3Selection } from "@/types";

// Draw a line perpendicular to the specified axis at the given axis value in screen coordinates.
export const drawSVGLine = (
  baseLayer: D3Selection<SVGGElement>,
  axisValueSC: number,
  axis: AxisUtil,
  otherAxisRangeSC: number[],
  strokeWidth: number,
  color: string
): D3Selection<SVGLineElement> => {
return baseLayer.append("g").append("line")
    .attr(`${axis.curr()}1`, axisValueSC)
    .attr(`${axis.curr()}2`, axisValueSC)
    .attr(`${axis.other()}1`, otherAxisRangeSC[0])
    .attr(`${axis.other()}2`, otherAxisRangeSC[1])
    .style("stroke", color).style("stroke-width", strokeWidth);
};