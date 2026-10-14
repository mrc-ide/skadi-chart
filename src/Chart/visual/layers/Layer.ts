import { PredrawLayer } from "./predraw/PredrawLayer";

export abstract class Layer extends PredrawLayer {
  abstract draw(): void;
};
