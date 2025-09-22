# Skadi Chart

This charting library provides a structured and thin wrapper around [d3](https://d3js.org)
to provide an fully flexible and extensible interface to plot customised graphs that
out-of-the-box solutions haven't prepared for.

There are many examples in [src/demo/App.vue](./src/demo/App.vue) which are used in a Vue context
however this library will work with base Javascript too.

# Installation

```
npm i skadi-chart
```

# Usage

## Base chart class

All charts start with the `Chart` class that takes in `ChartOptions` (e.g. `animationDuration`
in ms or `logScale`):

```ts
const chart = new Chart({ animationDuration: 500 });
```

## Layers

Skadi chart works in layers. Each layer "adds" something to the graph but also is completely
optional. To add a layer to the chart you have to call one of the methods below. These methods
can also take some arguments that configure how the layers appear and examples of each can
be found in [src/demo/App.vue](./src/demo/App.vue). For now, this is just an overview of the
methods `Chart` class provides for adding layers:

* `addAxes` will draw axes with tick marks, the axes can be autoscaled based on your
data or you can provide a fixed scale in the `appendTo` function below. Example:
  ```ts
  chart.addAxes();
  ```
* `addTraces` will add traces to the graph. This data will also be used for autoscaling the
axes if you haven't provided a fixed scale. Example:
  ```ts
  // must be of type Lines<Metadata> where Metadata can be null if you don't use any
  // Custom Metadata will be provided to the tooltips layer mentioned below
  declare const lines: Lines<Metadata>;

  chart.addTraces(lines);
  ```
* `addScatterPoints`
* `addGridLines` will add gridlines to the graph.
