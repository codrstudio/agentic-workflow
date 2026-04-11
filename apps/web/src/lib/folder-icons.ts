import {
  Folder,
  Briefcase,
  Package,
  Rocket,
  Lightbulb,
  Wrench,
  Target,
  Zap,
  Palette,
  Coffee,
  Tag,
  Database,
  Cloud,
  Users,
  Hammer,
  Flag,
  Bookmark,
  Code2,
  Heart,
  Pin,
  type LucideIcon,
} from "lucide-react"

export const FOLDER_ICONS: Array<{ name: string; Icon: LucideIcon }> = [
  { name: "folder", Icon: Folder },
  { name: "briefcase", Icon: Briefcase },
  { name: "package", Icon: Package },
  { name: "rocket", Icon: Rocket },
  { name: "lightbulb", Icon: Lightbulb },
  { name: "wrench", Icon: Wrench },
  { name: "target", Icon: Target },
  { name: "zap", Icon: Zap },
  { name: "palette", Icon: Palette },
  { name: "coffee", Icon: Coffee },
  { name: "tag", Icon: Tag },
  { name: "database", Icon: Database },
  { name: "cloud", Icon: Cloud },
  { name: "users", Icon: Users },
  { name: "hammer", Icon: Hammer },
  { name: "flag", Icon: Flag },
  { name: "bookmark", Icon: Bookmark },
  { name: "code-2", Icon: Code2 },
  { name: "heart", Icon: Heart },
  { name: "pin", Icon: Pin },
]

const ICON_MAP = new Map(FOLDER_ICONS.map((i) => [i.name, i.Icon]))

export function getFolderIcon(name?: string): LucideIcon {
  if (name) {
    const found = ICON_MAP.get(name)
    if (found) return found
  }
  return Folder
}
