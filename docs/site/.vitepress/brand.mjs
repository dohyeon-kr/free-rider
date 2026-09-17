import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BRAND_ICON_PATH = '/free-rider-app-icon.png'

// Use the same checked-in artwork as the desktop app. This also runs on Linux
// for GitHub Pages; unlike prepare-icon.cjs, no macOS icon tools are needed.
export function prepareBrandAssets({
  sourceDir = fileURLToPath(new URL('../../../build/icon-source/', import.meta.url)),
  publicDir = fileURLToPath(new URL('../public/', import.meta.url))
} = {}) {
  const chunks = readdirSync(sourceDir).filter(name => name.endsWith('.b64')).sort()
  if (chunks.length === 0) throw new Error('No app icon chunks found')

  const encoded = chunks.map(name => readFileSync(join(sourceDir, name), 'utf8').trim()).join('')
  const png = Buffer.from(encoded, 'base64')
  if (!encoded || png.toString('base64') !== encoded) {
    throw new Error('Invalid app icon base64')
  }
  if (png.length < 33 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('App icon source is not a PNG')
  }

  const outputPath = join(publicDir, BRAND_ICON_PATH.slice(1))
  mkdirSync(publicDir, { recursive: true })
  if (!existsSync(outputPath) || !readFileSync(outputPath).equals(png)) {
    writeFileSync(outputPath, png)
  }
  return outputPath
}
