# Skadi Chart

This charting library provides a structured and thin wrapper around [d3](https://d3js.org)
to provide an fully flexible and extensible interface to plot customised graphs that
out-of-the-box solutions haven't prepared for.

There are many examples in [src/demo/App.vue](./src/demo/App.vue) which are used in a Vue context
however this library will work with TypeScript or JavaScript too. Developer facing docs are in
[DEV_README](./DEV_README.md).

# Installation

```
npm i @reside-ic/skadi-chart
```

# Usage

## Example

Here is a quick example of using Skadi chart:

```html
<div id="chart"></div>
```

```ts
import {
    Lines,
    ScatterPoints,
    TooltipHtmlCallback,
    Scales,
    OptionalLayer,
    LayerType,
    LayerArgs
} from "@reside-ic/skadi-chart";

// get element from html document
const chart = document.getElementById("chart") as HTMLDivElement;

// example custom metadata: define a type that you can attach to lines or scatter points
type Metadata = { type: "line" | "point" }

// two straight lines, first one will also display the area underneath the trace
const lines: Lines<Metadata> = [
    {
        points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ],
        fill: true,
        style: { color: "black", fillColor: "blue", fillOpacity: 0.5 },
        metadata: { type: "line" }
    },
    {
        points: [
            { x: 0, y: 0 },
            { x: 1, y: 2 },
        ],
        style: { color: "red" },
        metadata: { type: "line" }
    },
];

// two points
const points: ScatterPoints<Metadata> = [
    {
        x: 0.5, y: 0.5,
        style: { radius: 2 },
        metadata: { type: "point" }
    },
    {
        x: 0.5, y: 1,
        style: { radius: 1 },
        metadata: { type: "point" }
    },
];

// custom tooltip with html string
const tooltipHtmlCallback: TooltipHtmlCallback = ({ x, y, metadata }) => {
    return `<p>Point x=${x}, y=${y} is a ${metadata.type}</p>`
};

// define x axis scale. The chart can compute y by autoscaling based on
// the data, or you could provide specific values for y here instead. 
const scales: Scales = {
    x: { start: 0, end: 1 }
};

// can extend Skadi chart with whatever functionality you'd like but it
// must fulfil the OptionalLayer contract
class CustomLayer extends OptionalLayer {
    type = LayerType.Custom;
    constructor() { super() };

    // adds a black circle to the svg
    draw(layerArgs: LayerArgs): void {
        const svg = layerArgs.coreLayers[LayerType.Svg];
        const { getHtmlId } = layerArgs;
        svg.append("svg:circle")
          .attr("id", `${getHtmlId(this.type)}-circle`)
          .attr("cx", "50%")
          .attr("cy", "50%")
          .attr("r", "5%")
    }
}

new Chart()
  .addAxes()
  .addTraces(lines)
  .addArea()
  .addScatterPoints(points)
  .addGridLines()
  .addZoom()
  .addTooltips(tooltipHtmlCallback)
  .addCustomLayer(new CustomLayer())
  .addCustomLifecycleHooks({ beforeZoom() { console.log("triggering before zoom") } })
  .makeResponsive()
  .appendTo(chart, scales);
```

# More details

## Base chart class

All charts start with the `Chart` class that takes in `ChartOptions`, e.g. `animationDuration`
in ms, `logScale`, or tick configuration options. See [here](./src/Chart.ts) for source code.

Examples:

```ts
const chart = new Chart()
const chartWithLongerAnimation = new Chart({ animationDuration: 500 });
const chartWithFewXAxisTicks = new Chart({ tickConfig: { numerical: { x: { size: 1 } } } });
```

## Layers

Skadi chart works in layers. Each layer "adds" something to the graph but also is completely
optional. 

### OptionalLayer and event handling

An optional layer in Skadi chart is a layer that extends the abstract class
[OptionalLayer](./src/layers/Layer.ts). This abstract class will expect the layers to define
a `draw` function that will be used when the layer is added to the svg.

Furthermore, it defines the lifecycle hooks a layer can plug into. Lifecycle hooks are how
the layers react to user events. For example, the layers can each define a `zoom` method that
the [ZoomLayer](./src/layers/ZoomLayer.ts) will call on each of the layers when the user
selects an area to zoom into.

### Adding layers

To add a ready-made layer to the chart, call one of the methods below. The order of appending
layers does not matter however currently the multiplicity of layers does matter, i.e if you
add 2 [AxesLayer](./src/layers/AxesLayer.ts)s it will draw 2 of them which may be unintended.
These methods can also take some arguments that configure how the layers appear and examples
of each can be found in [src/demo/App.vue](./src/demo/App.vue). For now, this is just an
overview of the methods [Chart](./src/Chart.ts) class provides for adding layers:

* `addAxes` adds an [AxesLayer](./src/layers/AxesLayer.ts). This will draw axes with tick
marks. The axes can be autoscaled based on your data or you can provide a fixed scale in
the `appendTo` function below. Both the arguments are optional. Note that the values passed in
the `labelPositions` argument are proportions: for example, `{ x: 0.5 }` would mean to position
the axis label halfway (50%) between the bottom edge of the graph and the bottom edge of the svg.
  ```ts
  labels = { x: "Time" }
  labelPositions = { x: 0.5 }
  chart.addAxes(labels, labelPositions);
  ```
* `addTraces` adds a [TracesLayer](./src/layers/TracesLayer.ts). This will add traces to
the graph. This data will also be used for autoscaling the axes if you haven't provided a
fixed scale.
  ```ts
  chart.addTraces(lines);
  ```
* `addArea` adds an [AreaLayer](./src/layers/AreaLayer.ts). This will add an area underneath
the traces that specify `{ fill: true }` property in their config to the graph.
  ```ts
  chart.addArea();
  ```
* `addScatterPoints` add a [ScatterLayer](./src/layers/ScatterLayer.ts). This will add
scatter points to the graph. This data will also be used for autoscaling the axes if you
haven't provided a fixed scale.
  ```ts
  chart.addScatterPoints(points);
  ```
* `addGridLines` adds a [GridLayer](./src/layers/GridLayer.ts). This will add gridlines
to the graph.
  ```ts
  chart.addGridLines();
  ```
* `addZoom` adds a [ZoomLayer](./src/layers/ZoomLayer.ts) which will render a brush (let
the user draw a rectangle where they wish to zoom) and provide these extents to each layer.
Each layer itself defines how it zooms so this will let the user zoom on your graph.
  ```ts
  chart.addZoom();
  ```
* `addTooltips` adds a [TooltipLayer](./src/layers/TooltipsLayer.ts) which adds tooltips
to the chart. For traces and points this means the tooltip will appear pointing to the
closest point in the graph to the cursor (once it is within a threshold). You must provide
a callback returning HTML to render the tooltip. You may optionally configure the radius (px)
within which a point triggers the tooltip to be displayed. You may also optionally specify an axis;
if you do, then the 'closest point' will be determined by the distance from the cursor on that axis.
For example, you may want to show the tooltip for the nearest x value regardless of y distance.
  ```ts
  chart.addTooltips(tooltipHtmlCallback, 25, "x");
  ```
* `makeResponsive` is not really a layer but will make your graph responsive (redraw on change
to container bounds and changes to window size).
  ```ts
  chart.makeResponsive();
  ```

#### Extending Skadi chart with custom layers

You can extend Skadi chart's functionality to suit your needs by defining a `CustomLayer`, as
long as it fulfils the contract of the class `OptionalLayer` found [here](./src/layers/Layer.ts).
Currently the `OptionalLayer` only requires you to define 2 things:

* the `type` of your `CustomLayer` which
should be `LayerType.Custom` (`LayerType` is an exported enum from the same file) in most cases.
* the `draw` function which will usually involve creating svg elements
* the `constructor` which needs to call `super`

In the example below, we define our `type` as `LayerType.Custom` and we define `draw` as adding a
black svg circle onto our graph using [d3.select](https://d3js.org/d3-selection/selecting).

We also declare a `beforeZoom` function to print a message before the zoom occurs. This is a
lifecycle hook that we can use to interact with the hook layer. For all the lifecycle hooks see
[here](./src/layers/Layer.ts).

```ts
class CustomLayer extends OptionalLayer {
    type = LayerType.Custom;
    constructor() { super() };

    // adds a black circle to the svg
    draw(layerArgs: LayerArgs): void {
        const svg = layerArgs.coreLayers[LayerType.Svg];
        const { getHtmlId } = layerArgs;
        svg.append("svg:circle")
          .attr("id", `${getHtmlId(this.type)}-circle`)
          .attr("cx", "50%")
          .attr("cy", "50%")
          .attr("r", "5%")
    }

    beforeZoom() { console.log("triggering before zoom") }
}

chart.addCustomLayer(new CustomLayer());
```

If we didn't want to draw anything to the svg and instead wanted to execute some code
via the lifecycle hooks, the`addCustomLifecycleHooks` offers an easier interface to do
this. It is a convenience wrapper around `addCustomLayer`.
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
chart.appendTo(element, scales);
```

## Reactivity

There is some reactivity baked into Skadi chart via the lifecycle hooks, such as zooming. In
general however there is very little reactivity that Skadi chart offers, e.g. there are not
any functions that will remove layers after the chart is appended to the DOM.

The pattern we use for reactivity outside of the scope of lifecycle hooks is to recreate the
chart from scratch. The `appendTo` function will remove anything inside the chart `div` and
append the new `Chart` into it. To see examples of reactivity see [here](./src/demo/App.vue).
