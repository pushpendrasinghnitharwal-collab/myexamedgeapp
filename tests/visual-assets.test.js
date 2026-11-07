import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { precacheAssets } from '../scripts/precache-assets.js'

const publicFile = (url) => join('public', new URL(url, 'https://examedge.example').pathname.replace(/^\//, ''))

test('the app icon set has usable standard and maskable PWA sizes', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
  for (const purpose of ['any', 'maskable']) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === purpose))
  }
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'))
  for (const icon of manifest.icons) {
    const file = await readFile(publicFile(icon.src))
    if (icon.type === 'image/png') {
      assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
      const [width, height] = icon.sizes.split('x').map(Number)
      assert.equal(file.readUInt32BE(16), width)
      assert.equal(file.readUInt32BE(20), height)
    } else {
      assert.match(file.toString(), /<svg\b/)
    }
  }
  const appleIcon = await readFile('public/apple-touch-icon.png')
  assert.equal(appleIcon.readUInt32BE(16), 180)
  assert.equal(appleIcon.readUInt32BE(20), 180)
})

test('decorative backgrounds resolve to optimized WebP assets', async () => {
  const css = (await Promise.all(['src/premium.css', 'src/refresh.css', 'src/studio.css', 'src/auth.css', 'src/finale.css'].map((path) => readFile(path, 'utf8')))).join('\n')
  const urls = [...css.matchAll(/url\(['"]?(\/images\/[^'")]+)['"]?\)/g)].map((match) => match[1])
  assert.ok(new Set(urls).size >= 3)
  for (const url of new Set(urls)) {
    const image = await readFile(publicFile(url))
    assert.equal(image.subarray(0, 4).toString(), 'RIFF')
    assert.equal(image.subarray(8, 12).toString(), 'WEBP')
    assert.ok(image.length < 250_000, `${url} should remain lightweight`)
  }
})

test('decorative backgrounds are available on a fresh offline install', async () => {
  const [worker, ...styles] = await Promise.all(
    ['public/sw.js', 'src/premium.css', 'src/refresh.css', 'src/studio.css', 'src/auth.css', 'src/finale.css'].map((path) => readFile(path, 'utf8'))
  )
  const urls = [...styles.join('\n').matchAll(/url\(['"]?(\/images\/[^'")]+)['"]?\)/g)].map((match) => match[1])
  assert.ok(urls.includes('/images/study-orbit.webp'))
  assert.ok(urls.includes('/images/exam-discovery.webp'))
  assert.ok(urls.includes('/images/edge-momentum.webp'))
  for (const url of new Set(urls)) assert.ok(worker.includes(`'${url}'`), `${url} is precached`)
})

test('production worker precaches the fingerprinted app shell', async () => {
  const root = await mkdtemp(join(tmpdir(), 'examedge-precache-'))
  try {
    const out = join(root, 'dist')
    await mkdir(join(out, 'assets'), { recursive: true })
    await Promise.all(['index-a.js', 'main-b.css', 'font-c.woff2', 'font-c.woff'].map((name) => writeFile(join(out, 'assets', name), 'fixture')))
    await writeFile(join(out, 'sw.js'), 'const BUILD_ASSETS = /* __BUILD_ASSETS__ */ []')
    const plugin = precacheAssets()
    plugin.configResolved({ root, build: { outDir: 'dist' } })
    await plugin.closeBundle()
    const worker = await readFile(join(out, 'sw.js'), 'utf8')
    assert.match(worker, /\/assets\/index-a\.js/)
    assert.match(worker, /\/assets\/main-b\.css/)
    assert.match(worker, /\/assets\/font-c\.woff2/)
    assert.doesNotMatch(worker, /\/assets\/font-c\.woff"/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
