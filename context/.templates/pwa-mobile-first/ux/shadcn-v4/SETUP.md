# shadcn/ui v4 -- Setup Reference

## Quick Start

```bash
npx shadcn@latest init        # setup existing project
npx shadcn@latest create      # scaffold new project (Next.js, Vite, TanStack Start)
npx shadcn@latest add button  # add a component
```

## Manual Dependencies

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react tw-animate-css
```
```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

## CSS Variables (globals.css -- Neutral theme, oklch)

```css
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0); --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0); --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0); --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0); --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325); --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0); --input: oklch(0.922 0 0); --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  --chart-1: oklch(0.646 0.222 41.116); --chart-2: oklch(0.6 0.118 184.704); --chart-3: oklch(0.398 0.07 227.392); --chart-4: oklch(0.828 0.189 84.429); --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0); --sidebar-foreground: oklch(0.145 0 0); --sidebar-primary: oklch(0.205 0 0); --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0); --sidebar-accent-foreground: oklch(0.205 0 0); --sidebar-border: oklch(0.922 0 0); --sidebar-ring: oklch(0.708 0 0);
}
.dark {
  --background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0); --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0); --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0); --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0); --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0); --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0); --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723); --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0); --input: oklch(0.269 0 0); --ring: oklch(0.439 0 0);
  --chart-1: oklch(0.488 0.243 264.376); --chart-2: oklch(0.696 0.17 162.48); --chart-3: oklch(0.769 0.188 70.08); --chart-4: oklch(0.627 0.265 303.9); --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0); --sidebar-foreground: oklch(0.985 0 0); --sidebar-primary: oklch(0.488 0.243 264.376); --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0); --sidebar-accent-foreground: oklch(0.985 0 0); --sidebar-border: oklch(0.269 0 0); --sidebar-ring: oklch(0.439 0 0);
}
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --color-chart-1: var(--chart-1); --color-chart-2: var(--chart-2); --color-chart-3: var(--chart-3); --color-chart-4: var(--chart-4); --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar); --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary); --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent); --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border); --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px); --radius-md: calc(var(--radius) - 2px); --radius-lg: var(--radius); --radius-xl: calc(var(--radius) + 4px);
}
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

## Dark Mode

### Next.js (next-themes)
```bash
npm install next-themes
```
```tsx
// components/theme-provider.tsx
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
// app/layout.tsx -- add suppressHydrationWarning to <html>, wrap children:
// <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
```

### Vite (manual context provider)
```tsx
// components/theme-provider.tsx -- exports ThemeProvider + useTheme
// Reads/writes localStorage("vite-ui-theme"), toggles root classList "dark"/"light"
// App.tsx: <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
```

### Astro
```astro
<script is:inline>
  const theme = localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.classList[theme === 'dark' ? 'add' : 'remove']('dark');
</script>
```

### Remix
```bash
npm install remix-themes  # cookie session + ThemeProvider; add :root[class~="dark"] to CSS
```

## Form Libraries

### React Hook Form + Zod
```bash
npx shadcn@latest add field input
npm install react-hook-form @hookform/resolvers zod
```
```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
const schema = z.object({ name: z.string().min(2) })
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "" } })
// <form onSubmit={form.handleSubmit(onSubmit)}>
//   <Controller name="name" control={form.control} render={({ field, fieldState }) => (
//     <Field data-invalid={fieldState.invalid}>
//       <FieldLabel htmlFor={field.name}>Name</FieldLabel>
//       <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
//       {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
//     </Field>
//   )} />
```

### TanStack Form + Zod
```bash
npm install @tanstack/react-form zod
```
```tsx
import { useForm } from "@tanstack/react-form"
const form = useForm({
  defaultValues: { name: "" },
  validators: { onSubmit: schema },
  onSubmit: async ({ value }) => { console.log(value) },
})
// <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
//   <form.Field name="name" children={(field) => {
//     const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
//     return <Field data-invalid={isInvalid}>
//       <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} />
//       {isInvalid && <FieldError errors={field.state.meta.errors} />}
//     </Field>
//   }} />
```

## Tailwind v4 Cursor Fix
```css
@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```

## Vite Config (required for Vite projects)
```ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
// tsconfig.json + tsconfig.app.json both need: { "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```
