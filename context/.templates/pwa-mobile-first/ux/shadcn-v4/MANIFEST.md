# shadcn/ui v4 -- AI Component Reference

> This is the primary entry point for AI coding assistants working with shadcn/ui v4 components.
> It contains a complete inventory of every component, chart, card, and example application in
> this reference, along with their file locations, exports, dependencies, and intended use cases.
> All data is extracted directly from annotated source file headers.

## Quick Navigation

- [SETUP.md](SETUP.md) -- Installation, CSS variables, dark mode, and framework configuration
- [PATTERNS.md](PATTERNS.md) -- Multi-component composition patterns (Combobox, DatePicker, DataTable, etc.)
- [api/ui-props.md](api/ui-props.md) -- Component props reference for all UI components
- [api/sidebar-api.md](api/sidebar-api.md) -- Sidebar system API, useSidebar hook, CSS variables
- [api/chart-api.md](api/chart-api.md) -- ChartConfig, ChartContainer, tooltip and legend system
- [api/form-api.md](api/form-api.md) -- Form anatomy, React Hook Form, TanStack Form, and Zod integration

---

## UI Components

| Component | File | Exports | Dependencies | Use For |
|-----------|------|---------|--------------|---------|
| Accordion | components/ui/accordion.tsx | Accordion, AccordionItem, AccordionTrigger, AccordionContent | @radix-ui/react-accordion | Collapsible content sections |
| Alert Dialog | components/ui/alert-dialog.tsx | AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel | @radix-ui/react-alert-dialog | Modal that interrupts user and expects a response |
| Alert | components/ui/alert.tsx | Alert, AlertTitle, AlertDescription | -- | Callouts for user attention |
| Aspect Ratio | components/ui/aspect-ratio.tsx | AspectRatio | @radix-ui/react-aspect-ratio | Content within a desired ratio |
| Avatar | components/ui/avatar.tsx | Avatar, AvatarImage, AvatarFallback | @radix-ui/react-avatar | User profile images with fallback |
| Badge | components/ui/badge.tsx | Badge, badgeVariants, BadgeProps | @radix-ui/react-slot | Status labels, tags, counts |
| Breadcrumb | components/ui/breadcrumb.tsx | Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis | @radix-ui/react-slot | Hierarchical navigation path display |
| Button Group | components/ui/button-group.tsx | ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants | -- | Group related buttons with consistent styling |
| Button | components/ui/button.tsx | Button, buttonVariants, ButtonProps | @radix-ui/react-slot | Clickable actions, form submits, links |
| Calendar | components/ui/calendar.tsx | Calendar, CalendarDayButton | react-day-picker@latest, date-fns | Date picking, date range selection |
| Card | components/ui/card.tsx | Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent | -- | Content containers with header, content, footer |
| Carousel | components/ui/carousel.tsx | type CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext | embla-carousel-react | Swipeable image/content slideshows |
| Chart | components/ui/chart.tsx | ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, ChartConfig | recharts@2.15.4, lucide-react | Data visualization wrapper (Recharts) |
| Checkbox | components/ui/checkbox.tsx | Checkbox | @radix-ui/react-checkbox | Boolean toggle, multi-select options |
| Collapsible | components/ui/collapsible.tsx | Collapsible, CollapsibleTrigger, CollapsibleContent | @radix-ui/react-collapsible | Expandable/collapsible panel toggle |
| Command | components/ui/command.tsx | Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator | cmdk | Search/command palette |
| Context Menu | components/ui/context-menu.tsx | ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuPortal, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuRadioGroup | @radix-ui/react-context-menu | Right-click menus, contextual actions |
| Dialog | components/ui/dialog.tsx | Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription | @radix-ui/react-dialog | Modal overlays, confirmations, forms |
| Drawer | components/ui/drawer.tsx | Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription | vaul, @radix-ui/react-dialog | Bottom sheet, mobile-friendly modals |
| Dropdown Menu | components/ui/dropdown-menu.tsx | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup | @radix-ui/react-dropdown-menu | Action menus, option lists on click |
| Empty | components/ui/empty.tsx | Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia | -- | Empty state placeholders, zero-data views |
| Field | components/ui/field.tsx | Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle | -- | Accessible form field layout with labels and help text |
| Form | components/ui/form.tsx | useFormField, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField | @radix-ui/react-label, @radix-ui/react-slot, @hookform/resolvers, zod, react-hook-form | Form state management and validation (RHF/Zod) |
| Hover Card | components/ui/hover-card.tsx | HoverCard, HoverCardTrigger, HoverCardContent | @radix-ui/react-hover-card | Preview content behind a link on hover |
| Input Group | components/ui/input-group.tsx | InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea | -- | Input with additional info, icons, buttons, addons |
| Input OTP | components/ui/input-otp.tsx | InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator | input-otp | One-time password/verification code input |
| Input | components/ui/input.tsx | Input | -- | Single-line text input field |
| Item | components/ui/item.tsx | Item, ItemMedia, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter | -- | Versatile list item, content display row |
| Kbd | components/ui/kbd.tsx | Kbd, KbdGroup | -- | Keyboard shortcut display |
| Label | components/ui/label.tsx | Label | @radix-ui/react-label | Accessible input labels |
| Menubar | components/ui/menubar.tsx | Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarPortal, MenubarSubContent, MenubarSubTrigger, MenubarGroup, MenubarSub, MenubarShortcut | @radix-ui/react-menubar | Desktop-style persistent menu bar |
| Navigation Menu | components/ui/navigation-menu.tsx | navigationMenuTriggerStyle, NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport | @radix-ui/react-navigation-menu | Site navigation with dropdowns |
| Pagination | components/ui/pagination.tsx | Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious | -- | Page navigation, prev/next links |
| Popover | components/ui/popover.tsx | Popover, PopoverTrigger, PopoverContent | @radix-ui/react-popover | Floating content panels, pickers |
| Progress | components/ui/progress.tsx | Progress | @radix-ui/react-progress | Task completion bars, loading indicators |
| Radio Group | components/ui/radio-group.tsx | RadioGroup, RadioGroupItem | @radix-ui/react-radio-group | Single selection from a set of options |
| Resizable | components/ui/resizable.tsx | ResizablePanelGroup, ResizablePanel, ResizableHandle | react-resizable-panels | Draggable resizable panel layouts |
| Scroll Area | components/ui/scroll-area.tsx | ScrollArea, ScrollBar | @radix-ui/react-scroll-area | Custom styled scrollable containers |
| Select | components/ui/select.tsx | Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton | @radix-ui/react-select | Dropdown selection from a list of options |
| Separator | components/ui/separator.tsx | Separator | @radix-ui/react-separator | Visual divider between content sections |
| Sheet | components/ui/sheet.tsx | Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription | @radix-ui/react-dialog | Slide-out side panel overlay |
| Sidebar | components/ui/sidebar.tsx | Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar | @radix-ui/react-slot, class-variance-authority, lucide-react | App navigation, collapsible side panel |
| Skeleton | components/ui/skeleton.tsx | Skeleton | -- | Loading placeholder shimmer |
| Slider | components/ui/slider.tsx | Slider | @radix-ui/react-slider | Range value selection via drag handle |
| Sonner | components/ui/sonner.tsx | Toaster | sonner, next-themes | Temporary notifications (via Sonner library) |
| Spinner | components/ui/spinner.tsx | Spinner | class-variance-authority | Loading spinner indicator |
| Switch | components/ui/switch.tsx | Switch | @radix-ui/react-switch | On/off toggle control |
| Table | components/ui/table.tsx | Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption | -- | Tabular data display |
| Tabs | components/ui/tabs.tsx | Tabs, TabsList, TabsTrigger, TabsContent | @radix-ui/react-tabs | Switch between content sections |
| Textarea | components/ui/textarea.tsx | Textarea | -- | Multi-line text input |
| Toast | components/ui/toast.tsx | type ToastProps, type ToastActionElement, ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction | @radix-ui/react-toast | Temporary notification messages (Radix-based) |
| Toaster | components/ui/toaster.tsx | Toaster | @radix-ui/react-toast | Toast rendering container (Radix) |
| Toggle Group | components/ui/toggle-group.tsx | ToggleGroup, ToggleGroupItem | @radix-ui/react-toggle-group | Multi-option on/off button set |
| Toggle | components/ui/toggle.tsx | Toggle, toggleVariants | @radix-ui/react-toggle | Two-state on/off button |
| Tooltip | components/ui/tooltip.tsx | Tooltip, TooltipTrigger, TooltipContent, TooltipProvider | @radix-ui/react-tooltip | Hover/focus info popup |

---

## Charts

| Component | File | Exports | Dependencies | Use For |
|-----------|------|---------|--------------|---------|
| Area Chart | components/charts/area-chart.tsx | (example component) | recharts | Area charts with 8 variants (axes, gradient, icons, legend, linear, stacked-expand, stacked, step) |
| Bar Chart | components/charts/bar-chart.tsx | (example component) | recharts | Bar charts with 9 variants (active, horizontal, interactive, label-custom, label, mixed, multiple, negative, stacked) |
| Line Chart | components/charts/line-chart.tsx | (example component) | recharts | Line charts with 9 variants (dots-colors, dots-custom, dots, interactive, label-custom, label, linear, multiple, step) |
| Pie Chart | components/charts/pie-chart.tsx | (example component) | recharts | Pie charts with 10 variants (donut-active, donut-text, donut, interactive, label-custom, label-list, label, legend, separator-none, simple, stacked) |
| Radar Chart | components/charts/radar-chart.tsx | (example component) | recharts | Radar charts with 13 variants (dots, grid-circle-fill, grid-circle-no-lines, grid-circle, grid-custom, grid-fill, grid-none, icons, label-custom, legend, lines-only, multiple, radius) |
| Radial Chart | components/charts/radial-chart.tsx | (example component) | recharts | Radial charts with 5 variants (grid, label, shape, simple, stacked, text) |
| Chart Interactive | components/charts/chart-interactive.tsx | (example component) | recharts | Interactive bar chart with state management and tab switching |

> See `components/charts/CHART-VARIANTS.md` for the full variant lookup table with 63 configurations.

---

## Cards (Example Compositions)

| Component | File | Exports | Dependencies | Use For |
|-----------|------|---------|--------------|---------|
| Activity Goal | components/cards/activity-goal.tsx | CardsActivityGoal | Button, Card, recharts | Goal setting with adjustable bar chart |
| Calendar | components/cards/calendar.tsx | CardsCalendar | Calendar, Card, date-fns | Date display card with calendar widget |
| Chat | components/cards/chat.tsx | CardsChat | Avatar, Button, Card, Command, Tooltip | Chat/messaging interface card |
| Cookie Settings | components/cards/cookie-settings.tsx | CardsCookieSettings | Button, Card, Switch | Cookie consent/preference settings |
| Create Account | components/cards/create-account.tsx | CardsCreateAccount | Button, Card, Input, Label, Select | Registration/sign-up form card |
| Exercise Minutes | components/cards/exercise-minutes.tsx | CardsExerciseMinutes | Card, recharts | Exercise tracking with line chart |
| Forms | components/cards/forms.tsx | CardsForms | Button, Card, Checkbox, Input, Label, Select, Textarea | Multi-field form card |
| Index | components/cards/index.tsx | CardsDemo | (all card components) | Composite demo of all card examples |
| Payment Method | components/cards/payment-method.tsx | CardsPaymentMethod | Button, Card, Input, Label, RadioGroup, Select | Payment method selection form |
| Payments | components/cards/payments.tsx | CardsPayments, columns, Payment | Card, Table, @tanstack/react-table | Data table card with sortable columns |
| Report Issue | components/cards/report-issue.tsx | CardsReportIssue | Button, Card, Input, Label, Select, Textarea | Issue reporting form card |
| Share | components/cards/share.tsx | CardsShare | Avatar, Button, Card, Input, Select | Share/invite dialog card |
| Stats | components/cards/stats.tsx | CardsStats | Button, Card, recharts | Statistics display with area/line charts |
| Team Members | components/cards/team-members.tsx | CardsTeamMembers | Avatar, Button, Card, Command, Popover, Select | Team member management card |

---

## Example Applications

| App | Directory | Description |
|-----|-----------|-------------|
| Dashboard | components/examples/dashboard/ | Full admin dashboard with sidebar navigation, interactive area chart, data table, section cards, and site header |
| Authentication | components/examples/authentication/ | Login/signup page with user auth form |
| Playground | components/examples/playground/ | AI playground with tabs, model selector, temperature/top-p controls, presets, and code viewer |
| Tasks | components/examples/tasks/ | Task management with TanStack Table data table, faceted filters, column sorting, pagination, and row actions |

---

## Documentation Files

| File | Description |
|------|-------------|
| SETUP.md | Installation and configuration (CSS variables, dark mode, framework configs) |
| PATTERNS.md | Multi-component composition patterns (Combobox, DatePicker, DataTable, etc.) |
| api/ui-props.md | Component props reference for all UI components |
| api/sidebar-api.md | Sidebar system API (hierarchy, useSidebar hook, CSS variables) |
| api/chart-api.md | Chart system API (ChartConfig, ChartContainer, tooltip/legend system) |
| api/form-api.md | Form integration API (RHF + TanStack Form + Zod anatomy) |
| components/charts/CHART-VARIANTS.md | Chart variant lookup table (63 variant configurations) |
