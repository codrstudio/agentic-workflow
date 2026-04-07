import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { join, basename, extname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ROOT = join(__dirname, "..")
const THEMES_SRC = join(ROOT, "assets", "themes")
const THEMES_OUT = join(ROOT, "apps", "frontend", "public", "themes")
const REGISTRY_OUT = join(ROOT, "apps", "frontend", "src", "themes", "registry.ts")

function extractBlock(css, selector) {
  const idx = css.indexOf(selector)
  if (idx === -1) return null

  let start = css.indexOf("{", idx)
  if (start === -1) return null

  let depth = 0
  let end = start
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++
    if (css[i] === "}") depth--
    if (depth === 0) {
      end = i + 1
      break
    }
  }

  return css.slice(idx, end)
}

function slugToLabel(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

async function main() {
  await mkdir(THEMES_OUT, { recursive: true })
  await mkdir(join(ROOT, "apps", "frontend", "src", "themes"), { recursive: true })

  const files = (await readdir(THEMES_SRC)).filter((f) => f.endsWith(".css")).sort()

  const registry = []

  for (const file of files) {
    const css = await readFile(join(THEMES_SRC, file), "utf-8")
    const slug = basename(file, extname(file))

    const rootBlock = extractBlock(css, ":root")
    const darkBlock = extractBlock(css, ".dark {")

    if (!rootBlock || !darkBlock) {
      console.warn(`⚠ Skipping ${file}: missing :root or .dark block`)
      continue
    }

    const output = `${rootBlock}\n\n${darkBlock}\n`
    await writeFile(join(THEMES_OUT, file), output, "utf-8")

    registry.push({ slug, label: slugToLabel(slug) })
  }

  const registryTs = `import type { ColorThemeRegistry } from "@ui/components/color-theme-provider"

export const themeRegistry: ColorThemeRegistry = ${JSON.stringify(registry, null, 2)}

export const DEFAULT_THEME = "default"
`

  await writeFile(REGISTRY_OUT, registryTs, "utf-8")

  console.log(`✓ ${files.length} themes → ${THEMES_OUT}`)
  console.log(`✓ registry → ${REGISTRY_OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
