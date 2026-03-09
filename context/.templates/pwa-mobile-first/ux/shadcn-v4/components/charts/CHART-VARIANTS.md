# Chart Variants Reference

> Use canonical charts in this directory as base templates.
> This table shows how each variant differs from the canonical version.

## Area Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-area-axes | YAxis + custom tick styling |
| chart-area-gradient | linearGradient fill with <defs> |
| chart-area-icons | icon property in chartConfig |
| chart-area-legend | <ChartLegend> + <ChartLegendContent> |
| chart-area-linear | type="linear" (no curve) |
| chart-area-stacked-expand | stackOffset="expand" for 100% stacked |
| chart-area-stacked | stackId="a" on multiple data series |
| chart-area-step | type="step" curve |

## Bar Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-bar-active | activeIndex/activeShape |
| chart-bar-horizontal | layout="vertical" on BarChart |
| chart-bar-interactive | activeIndex/activeShape |
| chart-bar-label-custom | Custom label renderer function |
| chart-bar-label | <LabelList> on data series |
| chart-bar-mixed | layout="vertical" + mixed Bar types |
| chart-bar-multiple | Multiple data series |
| chart-bar-negative | Negative values, cell fill by value |
| chart-bar-stacked | stackId="a" on multiple data series |

## Line Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-line-dots-colors | Per-dot color from data |
| chart-line-dots-custom | Custom dot renderer |
| chart-line-dots | dot/activeDot props on Line/Area |
| chart-line-interactive | activeIndex/activeShape |
| chart-line-label-custom | Custom label renderer function |
| chart-line-label | <LabelList> on data series |
| chart-line-linear | type="linear" (no curve) |
| chart-line-multiple | Multiple data series |
| chart-line-step | type="step" curve |

## Pie Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-pie-donut-active | innerRadius + activeIndex/activeShape |
| chart-pie-donut-text | innerRadius + custom <text> center |
| chart-pie-donut | innerRadius on Pie |
| chart-pie-interactive | activeIndex/activeShape |
| chart-pie-label-custom | Custom label renderer function |
| chart-pie-label-list | <LabelList> with position prop |
| chart-pie-label | <LabelList> on data series |
| chart-pie-legend | <ChartLegend> + <ChartLegendContent> |
| chart-pie-separator-none | stroke="none" on Pie |
| chart-pie-stacked | stackId="a" on multiple data series |

## Radar Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-radar-dots | dot/activeDot props on Line/Area |
| chart-radar-grid-circle-fill | gridType="circle" + fill |
| chart-radar-grid-circle-no-lines | gridType="circle" + no radial lines |
| chart-radar-grid-circle | gridType="circle" on PolarGrid |
| chart-radar-grid-custom | Custom PolarGrid styling |
| chart-radar-grid-fill | fill on PolarGrid |
| chart-radar-grid-none | No PolarGrid |
| chart-radar-icons | icon property in chartConfig |
| chart-radar-label-custom | Custom label renderer function |
| chart-radar-legend | <ChartLegend> + <ChartLegendContent> |
| chart-radar-lines-only | dot={false} on Radar |
| chart-radar-multiple | Multiple data series |
| chart-radar-radius | PolarRadiusAxis added |

## Radial Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-radial-grid | See source |
| chart-radial-label | <LabelList> on data series |
| chart-radial-shape | Custom shape property |
| chart-radial-stacked | stackId="a" on multiple data series |
| chart-radial-text | Custom center text via <text> |

## Tooltip Variants

| Variant | Key Config Change |
|---------|------------------|
| chart-tooltip-advanced | Custom content renderer |
| chart-tooltip-default | Default tooltip config |
| chart-tooltip-formatter | Custom formatter function |
| chart-tooltip-icons | icon in chartConfig entries |
| chart-tooltip-indicator-line | indicator="line" |
| chart-tooltip-indicator-none | hideIndicator |
| chart-tooltip-label-custom | Custom labelKey/labelFormatter |
| chart-tooltip-label-formatter | Custom formatter function |
| chart-tooltip-label-none | hideLabel |

