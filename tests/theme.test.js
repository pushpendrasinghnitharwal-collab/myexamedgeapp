import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Inspect the stylesheet values actually used by the colored progress cards.
// Keeping these small-text pairings at AA contrast helps prevent palette
// changes from making the user's real progress hard to read.
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `Missing CSS rule: ${selector}`)
  return match[1]
}

function color(block, property) {
  const match = block.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`))
  assert.ok(match, `Missing hex ${property} in ${block}`)
  return match[1]
}

function contrast(first, second) {
  const luminance = (hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const linear = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const [low, high] = [luminance(first), luminance(second)].sort((a, b) => a - b)
  return (high + 0.05) / (low + 0.05)
}

function atLeast(first, second, minimum, label) {
  const ratio = contrast(first, second)
  assert.ok(ratio >= minimum, `${label}: ${first} on ${second} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`)
}

test('colorful progress cards keep readable light and dark text', async () => {
  const css = await readFile('src/refresh.css', 'utf8')
  const light = rule(css, ":root,\nhtml[data-theme='light']")
  const dark = rule(css, "html[data-theme='dark']")
  for (const [theme, base, prefix] of [['light', light, ''], ['dark', dark, "html[data-theme='dark'] "]]) {
    const foregrounds = [color(base, '--text'), color(base, '--text-2')]
    for (const card of ['metric-purple', 'metric-blue', 'metric-peach', 'metric-mint', 'result-green', 'result-pink', 'result-orange', 'result-blue']) {
      const background = color(rule(css, `${prefix}.${card}`), 'background')
      for (const foreground of foregrounds) atLeast(foreground, background, 4.5, `${theme} ${card}`)
    }
    atLeast(color(base, '--ee-progress'), color(base, '--ee-progress-track'), 3, `${theme} progress ring`)
  }
})

test('installed app chrome matches the refreshed interface', async () => {
  const [manifestText, html, css] = await Promise.all([
    readFile('public/manifest.webmanifest', 'utf8'),
    readFile('index.html', 'utf8'),
    readFile('src/command-center.css', 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)
  const shell = rule(css, '.command-app,.cc-runner')
  assert.equal(manifest.background_color, color(shell, '--cc-bg'))
  assert.ok(html.includes(`<meta name="theme-color" content="${manifest.theme_color}"`))
  assert.ok(rule(css, '.cc-brand-mark,.cc-mobile-mark,.cc-runner-brand>span').includes(manifest.theme_color))
  assert.deepEqual(manifest.shortcuts.map(s => s.url), ['/#/mocks','/#/practice','/#/pyq','/#/current-affairs','/#/analytics'])
})
