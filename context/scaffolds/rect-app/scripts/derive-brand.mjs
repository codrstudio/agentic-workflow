import { readdir, readFile, copyFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const ROOT = join(__dirname, "..")

const BRAND_SRC = join(ROOT, "assets", "brand")
const PUBLIC = join(ROOT, "apps", "frontend", "public")

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const MASKABLE_BG = "#111827"
const MASKABLE_SAFE_ZONE = 0.1
const FAVICON_PNG_SIZES = [16, 32]
const APPLE_TOUCH_SIZE = 180

const IN_APP_BASES = ["logo", "logo-h", "logo-v", "creative-h", "creative-v"]

async function main() {
  const theme = process.argv[2]
  if (!theme || !["dark", "light"].includes(theme)) {
    console.error("Usage: node scripts/derive-brand.mjs <dark|light>")
    process.exit(1)
  }

  const iconPath = join(BRAND_SRC, theme, "icon.svg")
  if (!existsSync(iconPath)) {
    console.error(`Source not found: ${iconPath}`)
    process.exit(1)
  }

  const svgBuffer = await readFile(iconPath)
  const iconsOut = join(PUBLIC, "icons")
  const brandOut = join(PUBLIC, "brand")

  await mkdir(iconsOut, { recursive: true })
  await mkdir(brandOut, { recursive: true })

  // --- External assets (from icon-{theme}) ---

  // PWA icons
  for (const size of ICON_SIZES) {
    await sharp(svgBuffer).resize(size, size).png().toFile(join(iconsOut, `icon-${size}.png`))
  }
  console.log(`✓ ${ICON_SIZES.length} PWA icons`)

  // Maskable icons
  for (const size of MASKABLE_SIZES) {
    const innerSize = Math.round(size * (1 - MASKABLE_SAFE_ZONE * 2))
    const resized = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer()
    await sharp({
      create: { width: size, height: size, channels: 4, background: MASKABLE_BG },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toFile(join(iconsOut, `maskable-${size}.png`))
  }
  console.log(`✓ ${MASKABLE_SIZES.length} maskable icons`)

  // Favicon PNGs
  for (const size of FAVICON_PNG_SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(PUBLIC, `favicon-${size}x${size}.png`))
  }
  console.log(`✓ favicon PNGs`)

  // favicon.ico (32x32 PNG saved as .ico)
  await sharp(svgBuffer).resize(32, 32).png().toFile(join(PUBLIC, "favicon.ico"))
  console.log(`✓ favicon.ico`)

  // Apple touch icon
  await sharp(svgBuffer)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .png()
    .toFile(join(PUBLIC, "apple-touch-icon.png"))
  console.log(`✓ apple-touch-icon.png`)

  // --- In-app SVGs (both dark + light) ---

  let copied = 0
  for (const base of IN_APP_BASES) {
    for (const t of ["dark", "light"]) {
      const src = join(BRAND_SRC, t, `${base}.svg`)
      if (existsSync(src)) {
        await copyFile(src, join(brandOut, `${base}-${t}.svg`))
        copied++
      }
    }
  }
  console.log(`✓ ${copied} in-app SVGs`)

  console.log(`\nDone. External assets derived from: ${theme}/icon.svg`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
