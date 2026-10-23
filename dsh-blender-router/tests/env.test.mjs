import { loadCache, resolveBlenderExe, cachePath, __envInternals } from '../src/env.js'
import { matchOps, expandIntent } from '../src/synonyms.js'

let failed = 0
const ok = (cond, msg) => { if (!cond) { failed++; console.error('FAIL ' + msg) } else console.log('ok   ' + msg) }

// 1) blender 可执行文件探测（不启动）
const exe = resolveBlenderExe()
ok(!!exe.exe, '探测到 blender 路径：' + exe.exe + '（' + exe.source + '）')

// 2) 缓存（如果这台机器扫过）
const env = loadCache()
if (env) {
  ok(typeof env.blender === 'string' && env.blender.length > 0, '缓存里有 Blender 版本：' + env.blender)
  ok(Array.isArray(env.ops) && env.ops.length > 100, '缓存里有算子表（' + (env.ops || []).length + ' 个）')
  ok(Array.isArray(env.addons), '缓存里有 addon 列表（' + (env.addons || []).length + ' 个）')
  const m = matchOps('倒个角', env, 4)
  ok(m.items.length > 0, '「倒个角」能在环境里找到算子')
  ok(m.items.some((o) => /bevel/i.test(o.id) || o.mod === 'BEVEL'), '  含 bevel 相关项')
} else {
  console.log('skip 本机还没有环境缓存（跑一次 blender_env 或 refreshEnv 才有）')
}

// 3) 纯函数：同义词展开（不依赖环境）
const e1 = expandIntent('挖个孔')
ok(e1.tokens.includes('boolean'), '「挖个孔」展开出 boolean')
const e2 = expandIntent('倒个角')
ok(e2.tokens.includes('bevel'), '「倒个角」展开出 bevel')

// 4) 伪环境：不依赖真 Blender，验证匹配逻辑
const fakeEnv = {
  blender: 'x.y',
  ops: [
    { id: 'object.modifier_add', d: 'Add a procedural modifier', a: ['type'] },
    { id: 'mesh.bevel', d: 'Bevel edges', a: ['offset', 'segments'] },
    { id: 'uv.unwrap', d: 'Unwrap the mesh', a: ['method', 'margin'] },
  ],
  addons: [],
}
const fm = matchOps('倒个角', fakeEnv, 5)
ok(fm.items[0] && fm.items[0].mod === 'BEVEL', '伪环境：倒角优先给 modifier_add(BEVEL)')
const fm2 = matchOps('展个uv', fakeEnv, 5)
ok(fm2.items.some((o) => o.id === 'uv.unwrap'), '伪环境：UV 命中 uv.unwrap')

console.log('\ncache: ' + cachePath())
console.log(failed ? `${failed} 项失败` : 'env 检查通过')
process.exit(failed ? 1 : 0)
