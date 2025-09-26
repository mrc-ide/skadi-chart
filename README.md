# Skadi Chart

This charting library provides a structured and thin wrapper around [d3](https://d3js.org)
to provide an fully flexible and extensible interface to plot customised graphs that
out-of-the-box solutions haven't prepared for.

There are many examples in [src/demo/App.vue](./src/demo/App.vue) which are used in a Vue context
however this library will work with base Javascript too. Developer facing docs are in
[DEV_README](./DEV_README.md).

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
optional. 

### OptionalLayer and event handling

An optional layer in Skadi chart is a layer that extends the abstract class `OptionalLayer`.
This abstract class will expect the layers to define a `draw` function that will be used when
the layer is added to the svg.

Furthermore, it defines the lifecycle hooks a layer can plug
into. Lifecycle hooks are how the layers react to user events. For example, the layers can
each define a `zoom` method that the `ZoomLayer` will call on each of the layers when the user
selects an area to zoom into.

### Adding layers

To add a ready-made layer to the chart, call one of the methods below. These methods
can also take some arguments that configure how the layers appear and examples of each can
be found in [src/demo/App.vue](./src/demo/App.vue). For now, this is just an overview of the
methods `Chart` class provides for adding layers:

* `addAxes` will draw axes with tick marks, the axes can be autoscaled based on your
data or you can provide a fixed scale in the `appendTo` function below.
  ```ts
  chart.addAxes();
  ```
* `addTraces` will add traces to the graph. This data will also be used for autoscaling the
axes if you haven't provided a fixed scale.
  ```ts
  // must be of type Lines<Metadata> where Metadata can be null if you don't
  // use any. Custom Metadata will be provided to the tooltips layer
  // mentioned below
  declare const lines: Lines<Metadata>;

  chart.addTraces(lines);
  ```
* `addScatterPoints` will add scatter points to the graph. This data will also be used for
autoscaling the axes if you haven't provided a fixed scale.
  ```ts
  // must be of type ScatterPoints<Metadata> where Metadata can be null if
  // you don't use any. Custom Metadata will be provided to the tooltips
  // layer mentioned below
  declare const points: ScatterPoints<Metadata>;

  chart.addScatterPoints(points);
  ```
* `addGridLines` will add gridlines to the graph.
  ```ts
  chart.addGridLines();
  ```
* `addZoom` add a zoom layer which will render a brush (let the user draw a rectangle where
they wish to zoom) and provide these extents to each layer. Each layer itself defines how it
zooms so this will let the user zoom on your graph.
  ```ts
  chart.addZoom();
  ```
* `addTooltips` adds tooltips to the chart. For traces and points this means the tooltip will
appear pointing to the closest point in the graph to the cursor (once it is within a
threshold). You must provide a callback returning HTML to render the tooltip.
  ```ts
  // Metadata can be null if you don't use it but this should return a html
  // string that will be set as the innerHTML of the tooltip div. In this function
  // you can use the custom metadata to return custom tooltips
  declare const tooltipHtmlCallback: TooltipHtmlCallback<Metadata>;

  chart.addTooltips(tooltipHtmlCallback);
  ```
* `makeResponsive` is not really a layer but will make your graph responsive (redraw on change
to container bounds and changes to window size).
  ```ts
  chart.makeResponsive();
  ```

#### Extending Skadi chart with custom layers

You can extend Skadi chart's functionality to suit your needs by defining a `CustomLayer`, as
long as it fulfils the contract of the class `OptionalLayer`.

```ts
// must extend optional layer
declare class CustomLayer extends OptionalLayer {...};

chart.addCustomLayer(new CustomLayer());
```

`addCustomLifecycleHooks` is a convenience wrapper around `addCustomLayer` for when you
just want to hook into our lifecycle hooks.
  ```ts
  chart.addCustomLifecycleHooks({
    beforeZoom() { console.log("triggering before zoom") }
  });
  ```

## Drawing chart with all the layers

Once we have added all the layers, we must call `appendTo` function to draw the layers to the
screen. Without calling this function, nothing will be drawn to the screen. Here we can also
provide the scales to the graph if we want it to display a fixed scale rather than
automatically choosing a scale based on your data.

```ts
declare const element: HTMLDivElement;
declare const scales: Scales;

chart.appendTo(element, scales);
```
## All together

Combining all this, we can draw a chart that uses all of these features by:

```ts
declare const lines: Lines<Metadata>;
declare const points: ScatterPoints<Metadata>;
declare const tooltipHtmlCallback: TooltipHtmlCallback<Metadata>;
declare class CustomLayer extends OptionalLayer {...};
declare const element: HTMLDivElement;
declare const scales: Scales;

new Chart({ animationDuration: 500 })
  .addAxes()
  .addTraces(lines)
  .addScatterPoints(points)
  .addGridLines()
  .addZoom()
  .addTooltips(tooltipHtmlCallback)
  .addCustomLayer(new CustomLayer())
  .addCustomLifecycleHooks({ beforeZoom() { console.log("triggering before zoom") } })
  .makeResponsive()
  .appendTo(element, scales);
```
