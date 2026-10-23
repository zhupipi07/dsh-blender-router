import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const idx = JSON.parse(readFileSync(path.join(root, 'data', 'ops-index.json'), 'utf8'))
const fams = idx.families

let failed = 0
const ok = (cond, msg) => {
  if (!cond) { failed++; console.error('FAIL ' + msg) } else console.log('ok   ' + msg)
}

ok(Array.isArray(fams) && fams.length === 28, 'family 数 = 28（实际 ' + (fams || []).length + '）')
const seen = new Set()
for (const f of fams) {
  const id = String(f.f || '')
  ok(/^[a-z][a-z0-9_]*$/.test(id), 'family id 合法：' + id)
  ok(!seen.has(id), 'family id 不重复：' + id)
  seen.add(id)
  for (const k of ['title', 'use', 'dont', 'skel']) ok(!!String(f[k] || '').trim(), id + '.' + k + ' 非空')
  ok(Array.isArray(f.ops) && f.ops.length > 0, id + ' 至少 1 个 op')
  ok(Array.isArray(f.kw) && f.kw.length > 0, id + ' 至少 1 个关键词')
  for (const op of f.ops) ok(/^[a-z][a-z0-9_]*$/.test(String(op)), id + ' op 名合法：' + op)
}
const opTotal = fams.reduce((n, f) => n + f.ops.length, 0)
ok(opTotal >= 150, 'op 总数 >= 150（实际 ' + opTotal + '）')
console.log(failed ? `\n${failed} 项失败` : '\nindex 检查通过')
process.exit(failed ? 1 : 0)
