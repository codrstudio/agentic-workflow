# Chart API Reference

Charts use [Recharts](https://recharts.org/) under the hood. Install with `npx shadcn@latest add chart`. The shadcn chart components (`ChartContainer`, `ChartTooltip`, `ChartLegend`) are thin wrappers -- you compose charts using standard Recharts components.

## ChartConfig Type

The chart config maps data keys to labels, icons, and colors. It is intentionally decoupled from chart data.

```tsx
import { type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  desktop: {
    label: "Desktop",
    icon: Monitor,               // optional Lucide icon
    color: "#2563eb",            // direct color value
    // OR use theme object for light/dark:
    // theme: { light: "#2563eb", dark: "#dc2626" },
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",     // CSS variable reference
  },
} satisfies ChartConfig
```

### Type Definition

```ts
type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<"light" | "dark", string> }
  )
}
```

Each key in the config corresponds to a `dataKey` used in Recharts components. The config provides:
- `label`: Human-readable name (used in tooltips/legends)
- `icon`: Optional icon component
- `color`: Color string (hex, hsl, oklch, or CSS variable) -- mutually exclusive with `theme`
- `theme`: Light/dark color pair (`{ light: string, dark: string }`) -- mutually exclusive with `color`

## ChartContainer

Wraps your Recharts chart. Sets up the color CSS variables and provides responsive sizing.

```tsx
import { ChartContainer } from "@/components/ui/chart"

<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <BarChart data={chartData}>
    {/* Recharts components */}
  </BarChart>
</ChartContainer>
```

**Important:** Always set a `min-h-[VALUE]` on `ChartContainer` for proper responsive behavior.

Props:
- `config`: `ChartConfig` (required) -- the chart configuration object
- `className`: `string` -- must include a min-height

## ChartTooltip / ChartTooltipContent

Custom tooltip components that read from the chart config for labels and colors.

```tsx
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

<ChartTooltip content={<ChartTooltipContent />} />
```

### ChartTooltipContent Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `labelKey` | `string` | - | Config or data key to use for the tooltip label |
| `nameKey` | `string` | - | Config or data key to use for the tooltip name |
| `indicator` | `"dot" \| "line" \| "dashed"` | `"dot"` | Indicator style |
| `hideLabel` | `boolean` | `false` | Hide the label |
| `hideIndicator` | `boolean` | `false` | Hide the indicator |
| `formatter` | `(value, name, item, index, payload) => ReactNode` | - | Custom formatter for each tooltip entry (replaces default rendering) |
| `labelFormatter` | `(value, payload) => ReactNode` | - | Custom formatter for the tooltip label |
| `labelClassName` | `string` | - | Additional class for the label element |
| `color` | `string` | - | Override indicator color for all entries |

When `formatter` is provided and the item has a value and name, it completely replaces the default tooltip entry rendering. When `labelFormatter` is provided, it wraps the label value.

### Custom Label/Name Keys

```tsx
const chartConfig = {
  visitors: { label: "Total Visitors" },
  chrome: { label: "Chrome", color: "hsl(var(--chart-1))" },
  safari: { label: "Safari", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

<ChartTooltip content={<ChartTooltipContent labelKey="visitors" nameKey="browser" />} />
```

This uses "Total Visitors" as the label and resolves browser values ("chrome", "safari") to their config labels.

## ChartLegend / ChartLegendContent

Custom legend components that read from the chart config.

```tsx
import { ChartLegend, ChartLegendContent } from "@/components/ui/chart"

<ChartLegend content={<ChartLegendContent />} />
```

### ChartLegendContent Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nameKey` | `string` | - | Config or data key to use for legend names |
| `hideIcon` | `boolean` | `false` | Hide the color icon/swatch |
| `verticalAlign` | `"top" \| "bottom"` | `"bottom"` | Vertical alignment (adds `pb-3` or `pt-3`) |

```tsx
<ChartLegend content={<ChartLegendContent nameKey="browser" />} />
```

## Internal Helpers

- **`ChartStyle`** -- Injects `<style>` tags that create `--color-KEY` CSS variables from the config. Handles light/dark theme objects. Rendered automatically by `ChartContainer`.
- **`useChart()`** -- Hook that returns `{ config }` from `ChartContext`. Must be used inside `ChartContainer`. Used internally by tooltip/legend content components.
- **`ChartTooltip`** -- Direct re-export of `RechartsPrimitive.Tooltip` (no wrapper).
- **`ChartLegend`** -- Direct re-export of `RechartsPrimitive.Legend` (no wrapper).

## Color System

### Defining Colors in CSS

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
}

.dark {
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
}
```

### Referencing Colors

The `ChartContainer` automatically creates CSS variables from your config in the format `--color-KEY`.

In Recharts components:
```tsx
<Bar dataKey="desktop" fill="var(--color-desktop)" />
```

In chart data:
```tsx
const chartData = [
  { browser: "chrome", visitors: 275, fill: "var(--color-chrome)" },
]
```

In Tailwind classes:
```tsx
<LabelList className="fill-[--color-desktop]" />
```

## Complete Example

```tsx
"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

export function MyChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => value.slice(0, 3)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

## Accessibility

Add `accessibilityLayer` prop to any Recharts chart component for keyboard access and screen reader support:

```tsx
<BarChart accessibilityLayer data={data}>
```
