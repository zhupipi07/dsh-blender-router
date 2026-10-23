/**
 * dsh-blender-router — 让模型用上 Blender 插件全部能力面的路由层。
 *
 * 解决的是一个「可发现性」问题：dsh-blender-plugin 把 28 family / 186 op
 * 藏在 `blender_rt_plan(op="catalog")` 后面（11 KB），模型不主动查就只会
 * `primitive_cube_add`。本插件提供两个工具：
 *
 *   blender_route    意图 → 该用哪个 family / 哪条入口链（不必读整本目录）
 *   blender_coverage 读插件自己的 trajectory 日志，统计「到底用了几种」
 *
 * 另附一个随包 skill（skills/blender-toolrouter/SKILL.md）。
 * 设计原则：**任何一步失败都不能弄挂宿主** —— 全部 try/catch，出错只降级。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCache, refreshEnv, envAgeText } from './env.js'
import { matchOps, describeOp } from './synonyms.js'

const PLUGIN_VERSION = '1.1.0'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(HERE, '..')
const SKILL_DIR = path.join(PKG_ROOT, 'skills', 'blender-toolrouter')
const SKILL_NAME = 'blender-toolrouter'

let defineTool = null
try {
  ;({ defineTool } = await import('@deepseek-ai/dsh-tools'))
} catch (e) {
  // 宿主没有这个包时仍可被 import（单元测试 / 静态检查），但不会注册工具
  defineTool = null
}

/* ───────────────────────── 索引 ───────────────────────── */

let INDEX = null
function loadIndex() {
  if (INDEX) return INDEX
  const p = path.join(PKG_ROOT, 'data', 'ops-index.json')
  INDEX = JSON.parse(readFileSync(p, 'utf8'))
  return INDEX
}
function allFamilies() {
  try { return loadIndex().families || [] } catch (e) { return [] }
}

/* ───────────────────────── 匹配 ───────────────────────── */

function bigrams(s) {
  const t = String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  const out = new Map()
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2)
    out.set(g, (out.get(g) || 0) + 1)
  }
  return out
}
function sim(a, b) {
  const A = bigrams(a), B = bigrams(b)
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const [g, n] of A) if (B.has(g)) hit += Math.min(n, B.get(g))
  return (2 * hit) / (A.size + B.size)
}

function scoreFamily(fam, q) {
  const ql = String(q || '').toLowerCase()
  let score = 0
  const hits = []
  for (const kw of fam.kw || []) {
    const k = String(kw).toLowerCase()
    if (k && ql.includes(k)) {
      score += 2 + Math.min(2, k.length / 2)
      hits.push(kw)
    }
  }
  if (ql.includes(String(fam.f).toLowerCase())) score += 3
  for (const op of fam.ops || []) {
    if (ql.includes(String(op).toLowerCase())) {
      score += 4
      hits.push(op)
    }
  }
  score += 1.5 * sim(q, String(fam.title || '') + ' ' + String(fam.use || ''))
  return { score, hits: [...new Set(hits)] }
}

/** 运行时环境里匹配到的原生/第三方算子（环境变了它跟着变） */
function nativeBlock(intent, k = 4) {
  const env = loadCache()
  if (!env || !Array.isArray(env.ops) || !env.ops.length) {
    return '原生 / 第三方算子：还没扫过本机 Blender。调一次 blender_env（约 10–60 秒，之后缓存 12 小时）'
      + ' 就能按你真实装的 addon 路由。'
  }
  const addons = Array.isArray(env.addons) ? env.addons.length : 0
  const head = `原生 / 第三方算子（Blender ${env.blender || '?'} · ${addons} 个 addon · 缓存 ${envAgeText(env)}`
    + (env.stale ? ' · 已过期，建议 blender_env(refresh=true)' : '') + '）：'
  const m = matchOps(intent, env, k)
  if (!m.items.length) return head + '\n  没匹配到具体算子（可能该走上面的能力族）。'
  return head + '\n'
    + m.items.map((o) => '  · ' + describeOp(o)).join('\n')
    + '\n  用法：blender_rt_do(code="bpy.ops.<上面某个>()")；参数名照括号，值自己填。'
}

function route(intent, k) {
  const fams = allFamilies()
  if (!fams.length) return { ok: false, text: '索引缺失：data/ops-index.json 读不到或格式不对。' }
  const q = String(intent || '').trim()
  if (!q || q === '*') {
    const lines = fams.map((f, i) => `${String(i + 1).padStart(2, ' ')}. ${f.f} · ${f.title} —— ${String(f.skel).split('→')[0].trim()}`)
    return {
      ok: true,
      families: fams.map((f) => f.f),
      text: `Blender 能力面：${fams.length} family / ${fams.reduce((n, f) => n + (f.ops || []).length, 0)} op\n`
        + lines.join('\n')
        + '\n\n用 intent="<你要做的事>" 查具体入口；用 blender_rt_plan(op="catalog", args={family:"x"}) 看精确参数。',
    }
  }
  const ranked = fams
    .map((f) => ({ f, ...scoreFamily(f, q) }))
    .filter((r) => r.score >= 1.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(8, Number(k) || 3)))
  if (!ranked.length) {
    return {
      ok: false,
      families: [],
      text: `没有 family 命中「${q}」。\n`
        + '两种情况：① 这是纯几何编辑，直接用 blender_rt_do；'
        + '② 换个说法（用动词+名词，如「挖孔」「贴材质」「查穿模」「导出 glb」），'
        + '或用 intent="*" 看全表。\n\n'
        + nativeBlock(q, 5),
    }
  }
  const blocks = ranked.map((r, i) => {
    const f = r.f
    const ops = (f.ops || []).join(' · ')
    return `${i + 1}) ${f.f} · ${f.title}   [匹配 ${r.score.toFixed(1)}${r.hits.length ? ' · 命中 ' + r.hits.slice(0, 4).join('/') : ''}]\n`
      + `   什么时候用：${f.use}\n`
      + `   入口链：${f.skel}\n`
      + `   别用：${f.dont}\n`
      + `   全部 op（${(f.ops || []).length}）：${ops}\n`
      + `   下一步：blender_rt_plan(op="catalog", args={family:"${f.f}"}) 拿精确参数，再照骨架调用`
  })
  return {
    ok: true,
    families: ranked.map((r) => r.f.f),
    text: `意图「${q}」→ 命中 ${ranked.length} 个 family（全表 ${fams.length} 个）：\n\n`
      + blocks.join('\n\n')
      + '\n\n' + nativeBlock(q, 4)
      + '\n\n提示：参数名写错会报「不认识的参数」；不确定就先用 catalog 展开该 family。',
  }
}

/* ───────────────────────── 覆盖统计 ───────────────────────── */

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch (e) { return null }
}

function resolveTrajectoryDir(explicit) {
  if (explicit && existsSync(explicit)) {
    return statSync(explicit).isDirectory() ? explicit : path.dirname(explicit)
  }
  const envDir = process.env.DSH_BLENDER_WORKDIR
  if (envDir) {
    const t = path.join(envDir, 'trajectory')
    if (existsSync(t)) return t
  }
  const cfgs = [
    process.env.DSH_BLENDER_CONFIG,
    path.join(os.homedir(), '.dsh', 'dsh-blender.config.json'),
  ].filter(Boolean)
  for (const c of cfgs) {
    const j = readJson(c)
    if (j && j.workDir) {
      const t = path.join(String(j.workDir), 'trajectory')
      if (existsSync(t)) return t
    }
  }
  return null
}

function summarize(dir, days, topN) {
  const since = Date.now() - Math.max(1, Math.min(365, Number(days) || 7)) * 86400000
  const files = readdirSync(dir).filter((n) => /\.jsonl$/i.test(n))
  const famCount = new Map()
  const opCount = new Map()
  const routeCount = new Map()
  const daysSeen = new Set()
  let total = 0, okCount = 0, planCalls = 0
  for (const f of files) {
    let raw = ''
    try { raw = readFileSync(path.join(dir, f), 'utf8') } catch (e) { continue }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      let o = null
      try { o = JSON.parse(line) } catch (e) { continue }
      const t = Date.parse(o.t || '')
      if (!Number.isFinite(t) || t < since) continue
      total++
      if (o.ok) okCount++
      daysSeen.add(String(o.t).slice(0, 10))
      const r = String(o.route || 'unknown')
      routeCount.set(r, (routeCount.get(r) || 0) + 1)
      if (r === 'plan') {
        planCalls++
        const fam = o.family || (o.op ? String(o.op).split('_')[0] : null)
        if (fam && fam !== 'catalog' && fam !== 'help') famCount.set(fam, (famCount.get(fam) || 0) + 1)
        if (o.op) {
          const key = String(o.op)
          opCount.set(key, (opCount.get(key) || 0) + 1)
        }
      }
    }
  }
  return { total, okCount, planCalls, famCount, opCount, routeCount, daysSeen, files: files.length }
}

function coverageText(dir, days, topN) {
  const fams = allFamilies()
  const s = summarize(dir, days, topN)
  if (!s.total) {
    return {
      ok: false,
      text: `目录 ${dir} 里没有最近 ${days} 天的调用记录。\n`
        + '可能原因：这几天没用 dsh-blender-plugin；或 workDir 配置变了（看 ~/.dsh/dsh-blender.config.json 的 workDir）。',
    }
  }
  const used = [...s.famCount.entries()].sort((a, b) => b[1] - a[1])
  const usedNames = new Set(used.map(([k]) => k))
  const unused = fams.filter((f) => !usedNames.has(f.f)).map((f) => f.f)
  const topOps = [...s.opCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(3, Number(topN) || 10))
  const routes = [...s.routeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const pct = fams.length ? ((used.length / fams.length) * 100).toFixed(0) : '0'
  const lines = []
  lines.push(`Blender 能力使用统计 · 最近 ${days} 天 · ${s.daysSeen.size} 个活跃日 · ${s.files} 个日志文件`)
  lines.push(`总调用 ${s.total} · 成功 ${s.okCount}（${((s.okCount / s.total) * 100).toFixed(0)}%）· 其中 plan 调用 ${s.planCalls}`)
  lines.push(`能力面覆盖：${used.length}/${fams.length} family（${pct}%）`)
  lines.push('')
  lines.push('用过（次数）：' + (used.length ? used.map(([k, v]) => `${k}×${v}`).join(' · ') : '无'))
  lines.push('')
  lines.push('没用过：' + (unused.length ? unused.join(' · ') : '（全用过，厉害）'))
  lines.push('')
  lines.push('最常用 op：' + (topOps.length ? topOps.map(([k, v]) => `${k}×${v}`).join(' · ') : '无'))
  lines.push('调用类型：' + routes.map(([k, v]) => `${k}×${v}`).join(' · '))
  if (s.planCalls === 0) {
    lines.push('')
    lines.push('⚠ 这段时间一次 plan op 都没调 —— 模型仍在手写 bpy。先装 AGENTS.md 路由表，再用 blender_route 选 family。')
  } else if (used.length < 4) {
    lines.push('')
    lines.push('⚠ 只用到很少几个 family。下次开工前先用 blender_route 查一次意图，别默认从方块起步。')
  }
  return { ok: true, familiesUsed: used.length, familiesTotal: fams.length, text: lines.join('\n') }
}

/* ───────────────────────── 输出渲染 ───────────────────────── */

function renderText(_args, value) {
  return [{ type: 'text', text: String((value && value.text) || '') }]
}
const OUT = { schema: { type: 'json' }, render: renderText }

/* ───────────────────────── skill 注册 ───────────────────────── */

function readSkill() {
  try {
    const raw = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8')
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (!m) return null
    const meta = {}
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i < 0) continue
      let v = line.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      meta[line.slice(0, i).trim()] = v
    }
    const name = String(meta.name || '').trim()
    const description = String(meta.description || '').trim()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !description) return null
    return { name, description, content: raw.slice(m[0].length) }
  } catch (e) {
    return null
  }
}

function registerSkill(ctx, logger) {
  const skill = readSkill()
  if (!skill) {
    logger.warn?.('skill 未注册：skills/blender-toolrouter/SKILL.md 缺失或 frontmatter 不合法（不影响工具面）')
    return
  }
  const provider = {
    name: SKILL_NAME,
    list: async () => [{
      name: skill.name,
      description: skill.description,
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'bundled',
      provider: SKILL_NAME,
      rank: 610,
      resourceBase: { kind: 'directory', path: SKILL_DIR.split(path.sep).join('/') },
      path: path.join(SKILL_DIR, 'SKILL.md'),
      locator: path.join(SKILL_DIR, 'SKILL.md'),
    }],
    get: async () => ({
      name: skill.name,
      description: skill.description,
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'bundled',
      provider: SKILL_NAME,
      resourceBase: { kind: 'directory', path: SKILL_DIR.split(path.sep).join('/') },
      path: path.join(SKILL_DIR, 'SKILL.md'),
      content: skill.content,
    }),
  }
  const mount = (c) => {
    try { c.skills.registerProvider(() => provider) } catch (e) {
      logger.warn?.('skill 注册失败：' + String((e && e.message) || e) + '（不影响工具面）')
    }
  }
  try {
    if (typeof ctx.inject === 'function') ctx.inject(['skills'], mount)
    else if (ctx?.skills && typeof ctx.skills.registerProvider === 'function') mount(ctx)
  } catch (e) {
    logger.warn?.('skill 挂载失败：' + String((e && e.message) || e) + '（不影响工具面）')
  }
}

/* ───────────────────────── 入口 ───────────────────────── */

export function apply(ctx, config) {
  const logger = ctx?.logger || console
  if (!defineTool) {
    logger.warn?.('dsh-blender-router: 拿不到 @deepseek-ai/dsh-tools，改为直接注册原始 spec（失败只告警，skill 仍可用）')
  }
  const safeRegister = (spec, label) => {
    try {
      if (!ctx?.tools || typeof ctx.tools.register !== 'function') {
        logger.warn?.('dsh-blender-router: 宿主没有 tools 服务，跳过 ' + label)
        return
      }
      const tool = defineTool ? defineTool(spec) : spec
      try { ctx.effect(() => ctx.tools.register(tool), label) } catch (e) { ctx.tools.register(tool) }
    } catch (e) {
      logger.warn?.('dsh-blender-router: 注册 ' + label + ' 失败：' + String((e && e.message) || e))
    }
  }

  safeRegister({
    name: 'blender_route',
    description: '把「我要做什么」翻译成该用哪个 Blender 能力族（28 family / 186 op 的意图路由，不必先读整本 catalog）。'
      + ' 任何 Blender 任务开工前先调一次：intent 写动词+名词（如「挖孔」「贴金属材质」「查穿模」「导出 glb」「照截图做」「做履带」），'
      + ' 必要时给 k 多看几个候选。返回：匹配的 family、什么时候用、入口链、别用、全部 op、下一步该查哪条 catalog。'
      + ' intent="*" 直接看全表。它不执行任何 Blender 操作。',
    parameters: {
      intent: { type: 'string', description: '要做的事（自然语言，动词+名词）；"*" 列全表' },
      k: { type: 'integer', description: '返回几个候选 family，默认 3，最多 8' },
    },
    output: OUT,
    isConcurrencySafe: () => true,
    timeoutMs: 8000,
    async execute(args) {
      const r = route(args?.intent, args?.k)
      return { text: r.text, ok: !!r.ok, families: r.families || [] }
    },
  }, 'blender-router: route')

  safeRegister({
    name: 'blender_coverage',
    description: '统计 dsh-blender-plugin 最近一段时间到底用到了多少能力：读它自己的 trajectory 日志（每次调用的 route/op/family/ok），'
      + '算「用了几个 family / 共 28」「最常用 op」「没用过哪些」「plan 调用占比」。'
      + '用来验证「AI 是否真的用上了全部工具」，而不是凭感觉。默认最近 7 天。',
    parameters: {
      days: { type: 'number', description: '统计天数，默认 7' },
      dir: { type: 'string', description: 'trajectory 目录（默认从 DSH_BLENDER_WORKDIR 或 ~/.dsh/dsh-blender.config.json 的 workDir 推）' },
      top: { type: 'integer', description: '列出前 N 个常用 op，默认 10' },
    },
    output: OUT,
    isConcurrencySafe: () => true,
    timeoutMs: 15000,
    async execute(args) {
      const days = Number(args?.days) || 7
      const dir = resolveTrajectoryDir(args?.dir)
      if (!dir) {
        return {
          text: '找不到 trajectory 目录。\n'
            + '试三种办法：① 传 dir=<workDir>/trajectory；② 设环境变量 DSH_BLENDER_WORKDIR；'
            + '③ 确认 ~/.dsh/dsh-blender.config.json 里有 workDir。',
        }
      }
      const r = coverageText(dir, days, args?.top)
      return { text: r.text, ok: !!r.ok, dir, familiesUsed: r.familiesUsed ?? null, familiesTotal: r.familiesTotal ?? null }
    },
  }, 'blender-router: coverage')

  safeRegister({
    name: 'blender_env',
    description: '扫描本机 Blender 的**真实环境**：版本、已启用 addon（含第三方）、全部 bpy.ops 算子与参数名，缓存 12 小时。'
      + ' 因为 Blender 环境和 addon 会变，静态工具表迟早过期 —— 这个工具让路由跟着环境走。'
      + ' 装了新 addon、升级了 Blender、换了机器之后调一次 refresh=true。第一次约 10–60 秒（addon 多会更久）。'
      + ' 结果给 blender_route 用：它会从这份环境里挑「原生/第三方算子」。',
    parameters: {
      refresh: { type: 'boolean', description: 'true = 重新扫描（默认 false，读缓存；无缓存时会自动扫一次）' },
      exe: { type: 'string', description: '指定 blender 可执行文件（默认自动探测：DSH_BLENDER_EXE / dsh-blender.config.json / 安装目录）' },
      timeoutMs: { type: 'integer', description: '扫描超时，默认 120000' },
    },
    output: OUT,
    isConcurrencySafe: () => false,
    timeoutMs: 300000,
    async execute(args) {
      const refresh = !!args?.refresh
      let env = refresh ? null : loadCache()
      let source = '缓存'
      if (!env) {
        const r = await refreshEnv({ exe: args?.exe, timeoutMs: args?.timeoutMs })
        if (!r.ok) {
          return { text: '扫描失败：' + String(r.error || '未知原因') + '\n'
            + '排查：① 确认 Blender 路径（可传 exe=...）；② 设环境变量 DSH_BLENDER_EXE；'
            + '③ 首次扫描 addon 多时会慢，可加大 timeoutMs。' }
        }
        env = loadCache() || r
        source = '刚扫描'
      }
      const addons = Array.isArray(env.addons) ? env.addons : []
      const named = addons.map((a) => (a.name ? a.name + (a.version ? ' ' + a.version : '') : a.module)).filter(Boolean)
      const lines = [
        `Blender ${env.blender || '?'} · 可执行文件 ${env.exe || '?'}`,
        `addon ${addons.length} 个${named.length ? '：' + named.slice(0, 20).join(' · ') + (named.length > 20 ? ' …' : '') : ''}`,
        `算子 ${Array.isArray(env.ops) ? env.ops.length : 0} 个`,
        `缓存${source === '刚扫描' ? '已更新' : '：' + envAgeText(env)}${env.stale ? '（已过期，建议 refresh=true）' : ''}`,
        '',
        '下一步：blender_route(intent="你要做的事") —— 它会同时给「能力族」和「你环境里真实存在的算子」。',
      ]
      return { text: lines.join('\n'), ok: true, blender: env.blender || null, addons: addons.length, ops: Array.isArray(env.ops) ? env.ops.length : 0 }
    },
  }, 'blender-router: env')

  registerSkill(ctx, logger)
  logger.info?.('dsh-blender-router v' + PLUGIN_VERSION + ' 已加载（blender_route / blender_env / blender_coverage + skill ' + SKILL_NAME + '）')
}

export const __internals = { route, summarize, coverageText, resolveTrajectoryDir, scoreFamily, nativeBlock, matchOps, PLUGIN_VERSION }
export default { name: 'dsh-blender-router', apply }
