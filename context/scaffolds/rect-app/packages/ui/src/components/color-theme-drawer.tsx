import { useIsMobile } from "@ui/hooks/use-media-query"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@ui/components/ui/drawer"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@ui/components/ui/sheet"
import { cn } from "@ui/lib/utils"
import { ScrollArea } from "@ui/components/ui/scroll-area"
import { ColorThemePicker } from "@ui/components/color-theme-picker"

interface ColorThemeDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ColorThemeDrawer({ open, onOpenChange }: ColorThemeDrawerProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="mb-4 p-0 px-4 pt-4">
            <DrawerTitle>Paleta de cores</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <ColorThemePicker />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0"
        overlayClassName="!backdrop-blur-none"
      >
        <SheetHeader className="p-4">
          <SheetTitle>Paleta de cores</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          <ColorThemePicker />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
