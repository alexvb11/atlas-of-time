// Builds src/i18n/<lang>.json from the translation sheets in this folder. keys.txt lists the
// interface's English strings, one per line; each "## <lang>" block in a sheet has one line per key
// in the same order ("=" keeps the English). Run after adding a key or editing a translation.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(dir, '../../src/i18n')
const keys = (await fs.readFile(path.join(dir, 'keys.txt'), 'utf8')).replace(/\n$/, '').split('\n')
for (const f of (await fs.readdir(dir)).filter((f) => f.endsWith('.txt') && f !== 'keys.txt')) {
  const text = await fs.readFile(path.join(dir, f), 'utf8')
  for (const block of text.split(/^## /m).slice(1)) {
    const [lang, ...lines] = block.replace(/\n+$/, '').split('\n')
    if (lines.length !== keys.length) throw new Error(`${f} ${lang}: ${lines.length} lines for ${keys.length} keys`)
    const dict = {}
    keys.forEach((k, i) => {
      if (lines[i] !== '=' && lines[i] !== k) dict[k] = lines[i]
    })
    await fs.writeFile(path.join(out, `${lang}.json`), JSON.stringify(dict, null, 0))
    console.log(lang, Object.keys(dict).length)
  }
}
