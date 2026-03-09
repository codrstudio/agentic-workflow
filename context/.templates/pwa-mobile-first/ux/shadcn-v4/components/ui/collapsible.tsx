/**
 * @component Collapsible
 * @description An interactive component which expands/collapses a panel.
 * @dependencies @radix-ui/react-collapsible
 * @exports Collapsible, CollapsibleTrigger, CollapsibleContent
 */
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
