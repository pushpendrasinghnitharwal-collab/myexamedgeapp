import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Vite fingerprints the app shell on every build. Put those exact files in the
// new worker's cache before it takes control, including during a PWA upgrade.
// This also makes the locally hosted interface fonts available offline.
export function precacheAssets() {
  let outputDirectory
  return {
    name: 'examedge-precache-assets',
    apply: 'build',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const assetDirectory = resolve(outputDirectory, 'assets')
      const assets = (await readdir(assetDirectory))
        .filter((name) => /\.(?:js|css|woff2)$/.test(name))
        .map((name) => `/assets/${name}`)
        .sort()
      const worker = resolve(outputDirectory, 'sw.js')
      const source = await readFile(worker, 'utf8')
      const marker = '/* __BUILD_ASSETS__ */ []'
      if (!source.includes(marker) || !assets.some((asset) => asset.endsWith('.js'))) {
        throw new Error('Unable to prepare the ExamEdge offline app shell')
      }
      await writeFile(worker, source.replace(marker, JSON.stringify(assets)))
    },
  }
}
