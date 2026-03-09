# Sidebar API Reference

The Sidebar is a composable, themeable component. Install with `npx shadcn@latest add sidebar`.

## Component Hierarchy

```
SidebarProvider          -- Context provider, handles collapsible state
  Sidebar                -- Main container (left|right, sidebar|floating|inset)
    SidebarHeader        -- Sticky top section
    SidebarContent       -- Scrollable middle (contains SidebarGroups)
      SidebarGroup       -- Section wrapper
        SidebarGroupLabel
        SidebarGroupAction
        SidebarGroupContent
          SidebarMenu
            SidebarMenuItem
              SidebarMenuButton
              SidebarMenuAction
              SidebarMenuBadge
              SidebarMenuSub
                SidebarMenuSubItem
                  SidebarMenuSubButton
            SidebarMenuSkeleton
    SidebarFooter        -- Sticky bottom section
    SidebarSeparator
    SidebarRail          -- Thin rail for toggling
  SidebarInset           -- Main content area (use with variant="inset")
  SidebarTrigger         -- Toggle button
```

## SidebarProvider

Wraps your app. Manages open/collapsed state, persists via cookie.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultOpen` | `boolean` | `true` | Default open state |
| `open` | `boolean` | - | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | - | Controlled callback |

### Width CSS Variables

Set via `style` prop on `SidebarProvider`:

```tsx
<SidebarProvider style={{ "--sidebar-width": "20rem", "--sidebar-width-mobile": "20rem" }}>
```

Default widths (configurable in `sidebar.tsx`):
```ts
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
```

### Keyboard Shortcut

Default: `cmd+b` (Mac) / `ctrl+b` (Windows). Change via:
```ts
const SIDEBAR_KEYBOARD_SHORTCUT = "b"
```

### Persisted State (Next.js)

```tsx
import { cookies } from "next/headers"

export async function Layout({ children }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <main>{children}</main>
    </SidebarProvider>
  )
}
```

Cookie name configurable: `const SIDEBAR_COOKIE_NAME = "sidebar_state"`

## Sidebar

Main sidebar container.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `side` | `"left" \| "right"` | `"left"` | Which side |
| `variant` | `"sidebar" \| "floating" \| "inset"` | `"sidebar"` | Visual variant |
| `collapsible` | `"offcanvas" \| "icon" \| "none"` | `"offcanvas"` | Collapse behavior |

### Collapsible Modes

| Mode | Description |
|------|-------------|
| `offcanvas` | Slides in/out from the side |
| `icon` | Collapses to icon-only width |
| `none` | Non-collapsible, always visible |

### Inset Variant

When using `variant="inset"`, wrap main content in `SidebarInset`:

```tsx
<SidebarProvider>
  <Sidebar variant="inset" />
  <SidebarInset><main>{children}</main></SidebarInset>
</SidebarProvider>
```

## useSidebar Hook

```tsx
import { useSidebar } from "@/components/ui/sidebar"

const { state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar } = useSidebar()
```

| Property | Type | Description |
|----------|------|-------------|
| `state` | `"expanded" \| "collapsed"` | Current sidebar state |
| `open` | `boolean` | Whether sidebar is open (desktop) |
| `setOpen` | `(open: boolean) => void` | Set desktop open state |
| `openMobile` | `boolean` | Whether sidebar is open (mobile) |
| `setOpenMobile` | `(open: boolean) => void` | Set mobile open state |
| `isMobile` | `boolean` | Whether viewport is mobile |
| `toggleSidebar` | `() => void` | Toggle sidebar (works on both) |

## SidebarMenu Components

### SidebarMenuButton

Renders a button inside a `SidebarMenuItem`. Use `asChild` for links.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Render as child element (e.g. `<a>`) |
| `isActive` | `boolean` | `false` | Mark as active (applies accent styles) |
| `variant` | `"default" \| "outline"` | `"default"` | Visual variant |
| `size` | `"default" \| "sm" \| "lg"` | `"default"` | Button size (`h-8`, `h-7`, `h-12`) |
| `tooltip` | `string \| TooltipContentProps` | - | Tooltip shown when sidebar is collapsed to icons |

```tsx
<SidebarMenuButton asChild isActive tooltip="Dashboard">
  <a href="/dashboard"><Home /><span>Dashboard</span></a>
</SidebarMenuButton>
```

The `tooltip` prop is only visible when `state === "collapsed"` and not on mobile.

### SidebarMenuAction

Independent action button alongside `SidebarMenuButton`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Render as child element |
| `showOnHover` | `boolean` | `false` | Only show on hover/focus (hidden by default on desktop) |

Commonly used with `DropdownMenu`:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild>
    <a href="#"><Home /><span>Home</span></a>
  </SidebarMenuButton>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <SidebarMenuAction><MoreHorizontal /></SidebarMenuAction>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="right" align="start">
      <DropdownMenuItem>Edit</DropdownMenuItem>
      <DropdownMenuItem>Delete</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</SidebarMenuItem>
```

### SidebarMenuBadge

```tsx
<SidebarMenuItem>
  <SidebarMenuButton />
  <SidebarMenuBadge>24</SidebarMenuBadge>
</SidebarMenuItem>
```

### SidebarMenuSkeleton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showIcon` | `boolean` | `false` | Show an icon skeleton placeholder |

### SidebarMenuSubButton

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Render as child element |
| `size` | `"sm" \| "md"` | `"md"` | Sub-button size |
| `isActive` | `boolean` | - | Mark as active |

### SidebarGroupLabel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Render as child (use for `CollapsibleTrigger`) |

### SidebarGroupAction

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Render as child element |

### SidebarMenuSub (Submenu)

```tsx
<SidebarMenuItem>
  <SidebarMenuButton />
  <SidebarMenuSub>
    <SidebarMenuSubItem>
      <SidebarMenuSubButton />
    </SidebarMenuSubItem>
  </SidebarMenuSub>
</SidebarMenuItem>
```

### Collapsible Menu

Wrap with `Collapsible` for expandable/collapsible submenus:

```tsx
<SidebarMenu>
  <Collapsible defaultOpen className="group/collapsible">
    <SidebarMenuItem>
      <CollapsibleTrigger asChild>
        <SidebarMenuButton />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          <SidebarMenuSubItem />
        </SidebarMenuSub>
      </CollapsibleContent>
    </SidebarMenuItem>
  </Collapsible>
</SidebarMenu>
```

### Collapsible SidebarGroup

```tsx
<Collapsible defaultOpen className="group/collapsible">
  <SidebarGroup>
    <SidebarGroupLabel asChild>
      <CollapsibleTrigger>
        Help
        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
      </CollapsibleTrigger>
    </SidebarGroupLabel>
    <CollapsibleContent>
      <SidebarGroupContent />
    </CollapsibleContent>
  </SidebarGroup>
</Collapsible>
```

### SidebarMenuSkeleton Example

```tsx
<SidebarMenu>
  {Array.from({ length: 5 }).map((_, index) => (
    <SidebarMenuItem key={index}>
      <SidebarMenuSkeleton showIcon />
    </SidebarMenuItem>
  ))}
</SidebarMenu>
```

## CSS Variables for Theming

```css
:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}
```

Sidebar intentionally uses separate color variables from the main app to allow different styling (e.g. darker sidebar).

## Configurable Constants (in `sidebar.tsx`)

| Constant | Default | Description |
|----------|---------|-------------|
| `SIDEBAR_WIDTH` | `"16rem"` | Desktop sidebar width |
| `SIDEBAR_WIDTH_MOBILE` | `"18rem"` | Mobile sidebar width (Sheet) |
| `SIDEBAR_WIDTH_ICON` | `"3rem"` | Width when collapsed to icons |
| `SIDEBAR_KEYBOARD_SHORTCUT` | `"b"` | Key for cmd/ctrl+key toggle |
| `SIDEBAR_COOKIE_NAME` | `"sidebar_state"` | Cookie name for persistence |
| `SIDEBAR_COOKIE_MAX_AGE` | `604800` (7 days) | Cookie max-age in seconds |

## Data Attributes for Styling

The sidebar sets these `data-*` attributes for CSS/Tailwind targeting:

| Attribute | Values | Set On |
|-----------|--------|--------|
| `data-state` | `"expanded"` \| `"collapsed"` | Sidebar wrapper |
| `data-collapsible` | `"offcanvas"` \| `"icon"` \| `""` | Sidebar wrapper (when collapsed) |
| `data-variant` | `"sidebar"` \| `"floating"` \| `"inset"` | Sidebar wrapper |
| `data-side` | `"left"` \| `"right"` | Sidebar wrapper |
| `data-active` | `"true"` \| `"false"` | SidebarMenuButton |
| `data-size` | `"default"` \| `"sm"` \| `"lg"` | SidebarMenuButton |
| `data-mobile` | `"true"` | Sidebar (on mobile, renders inside Sheet) |

## Styling Tips

Hide element when sidebar is collapsed to icons:
```tsx
<SidebarGroup className="group-data-[collapsible=icon]:hidden" />
```

Force menu action visible when button is active:
```tsx
<SidebarMenuAction className="peer-data-[active=true]/menu-button:opacity-100" />
```

## Full Layout Example

```tsx
// app/layout.tsx
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  )
}

// components/app-sidebar.tsx
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Logo / workspace selector */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <a href="/"><Home /><span>Home</span></a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* User menu */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
```
