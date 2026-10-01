import { PredrawLayer } from "./predraw/PredrawLayer";

export abstract class Layer<_M> extends PredrawLayer<_M> {
  abstract draw(): void;
};
