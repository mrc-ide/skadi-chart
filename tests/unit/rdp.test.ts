import { RDPAlgorithm } from "@/layers/TracesLayer";
import { Point } from "@/types";

describe("RDP algorithm", () => {
  test("RDP algorithm works as expected", () => {
    const lines: Point[][] = [
      [
        { x: 0, y: 0 },
        { x: 2, y: 3 },
        { x: 8, y: 5 },
        { x: 10, y: 10 },
      ]
    ]
    
    // see https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm#Algorithm
    // RDP algorithm will start off with straight line between (0, 0) and
    // (10, 10) so line y = x.
    //
    // distance of (2, 3) from y = x is 0.707
    // distance of (8, 5) from y = x is 2.121
    //
    // if we set epsilon > 2.121 then both (2, 3) and (8, 5) are within
    // epsilon distance from y = x so both points can be removed
    expect(RDPAlgorithm(lines, 2.122)[0]).toStrictEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);

    // if we set epsilon < 2.121 RDP algorithm will iterate and apply
    // its logic to two sections (splitting at (8, 5) because it is the
    // furthest point from y = x that isn't within epsilon distance):
    // 1. (0, 0) to (8, 5)
    // 2. (8, 5) to (10, 10)
    //
    // section 2 only has 2 points so both will be included in the final
    // line. section 1 has point (2, 3) in it and the distance of (2, 3)
    // from 8y = 5x (line between (0, 0) and (8, 5)) is 1.484
    // 
    // so 1.484 < epsilon < 2.121 removes point (2, 3) and epsilon < 1.484
    // keeps the point
    expect(RDPAlgorithm(lines, 2.120)[0]).toStrictEqual([
      { x: 0, y: 0 },
      { x: 8, y: 5 },
      { x: 10, y: 10 },
    ]);

    expect(RDPAlgorithm(lines, 1.485)[0]).toStrictEqual([
      { x: 0, y: 0 },
      { x: 8, y: 5 },
      { x: 10, y: 10 },
    ]);

    expect(RDPAlgorithm(lines, 1.483)[0]).toStrictEqual([
      { x: 0, y: 0 },
      { x: 2, y: 3 },
      { x: 8, y: 5 },
      { x: 10, y: 10 },
    ]);
  });
});
