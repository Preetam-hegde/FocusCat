import { promises as fs } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const SOURCE_DIR = path.join(ROOT, "public", "sprites")
const OUTPUT_DIR = path.join(SOURCE_DIR, "split")

const TILE_SIZE = 32
const FRAMES_PER_ANIMATION = 4
const ANIMATION_ROW = 1

const ANIMATIONS = [
  { name: "sitting_down", group: 0, fps: 2 },
  { name: "looking_around", group: 1, fps: 2 },
  { name: "laying_down", group: 2, fps: 2 },
  { name: "walking", group: 3, fps: 6 },
  { name: "running", group: 4, fps: 10 },
  { name: "running2", group: 5, fps: 12 },
]

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function getSourceSheets() {
  const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => entry.name)
    .sort()
}

async function splitSheet(fileName) {
  const sourcePath = path.join(SOURCE_DIR, fileName)
  const catId = path.parse(fileName).name
  const outputCatDir = path.join(OUTPUT_DIR, catId)
  await ensureDir(outputCatDir)

  const image = sharp(sourcePath)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read dimensions for ${fileName}`)
  }

  if (metadata.width % TILE_SIZE !== 0 || metadata.height % TILE_SIZE !== 0) {
    throw new Error(`Sheet ${fileName} is not aligned to ${TILE_SIZE}x${TILE_SIZE} cells`)
  }

  const animations = {}

  for (const animation of ANIMATIONS) {
    const framePaths = []
    for (let index = 0; index < FRAMES_PER_ANIMATION; index += 1) {
      const left = (animation.group * FRAMES_PER_ANIMATION + index) * TILE_SIZE
      const top = ANIMATION_ROW * TILE_SIZE
      const outName = `${animation.name}_${index}.png`
      const outPath = path.join(outputCatDir, outName)

      await image
        .clone()
        .extract({
          left,
          top,
          width: TILE_SIZE,
          height: TILE_SIZE,
        })
        .png()
        .toFile(outPath)

      framePaths.push(`/sprites/split/${catId}/${outName}`)
    }

    animations[animation.name] = {
      fps: animation.fps,
      loop: true,
      frames: framePaths,
    }
  }

  return {
    id: catId,
    sheet: `/sprites/${fileName}`,
    tileSize: TILE_SIZE,
    animations,
  }
}

async function cleanOutputDir() {
  await ensureDir(OUTPUT_DIR)
  const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => fs.rm(path.join(OUTPUT_DIR, entry.name), { recursive: true, force: true })),
  )
}

async function main() {
  await cleanOutputDir()
  const sourceSheets = await getSourceSheets()

  if (!sourceSheets.length) {
    throw new Error("No source sprite sheets found in public/sprites")
  }

  const cats = []
  for (const sheet of sourceSheets) {
    const cat = await splitSheet(sheet)
    cats.push(cat)
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    frameSize: TILE_SIZE,
    framesPerAnimation: FRAMES_PER_ANIMATION,
    animations: ANIMATIONS.map(({ name, fps }) => ({ name, fps, loop: true })),
    cats,
  }

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json")
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  console.log(`Generated ${cats.length} cats into ${path.relative(ROOT, OUTPUT_DIR)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})