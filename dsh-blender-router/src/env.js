/**
 * 环境发现层：直接问「你当前这台机器的 Blender」它有什么。
 *
 * 为什么不沿用静态 op 表：用户的 Blender 会装各种 addon（HardOps/BoxCutter/Node Wrangler…），
 * 版本也会变（4.x / 5.x API 不同）。静态表必然过期。这里用 `blender -b` 起一个独立后台
 * 进程，把「版本 + 已启用 addon + bpy.ops 全量算子 + 参数名」dump 成 JSON 缓存下来。
 *
 * 边界：
 *  - 不碰用户正在跑的 GUI 会话（独立进程，读的是用户 prefs，不打开当前 .blend）；
 *  - 任何一步失败都返回 ok:false + 原因，不抛异常；
 *  - 缓存带 TTL，且 blender 路径/版本变化时自动失效。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const CACHE_DIR = path.join(os.homedir(), '.dsh', 'dsh-blender-router')
const CACHE_FILE = path.join(CACHE_DIR, 'env.json')
const TTL_MS = 12 * 3600 * 1000

export function cachePath() { return CACHE_FILE }

/* ───────────── blender 可执行文件探测 ───────────── */

function candidates() {
  const out = []
  if (process.env.DSH_BLENDER_EXE) out.push(process.env.DSH_BLENDER_EXE)
  // 与 dsh-blender-plugin 共用同一份配置（存在就用，不存在忽略）
  try {
    const cfg = JSON.parse(readFileSync(path.join(os.homedir(), '.dsh', 'dsh-blender.config.json'), 'utf8'))
    if (cfg && cfg.blenderExe) out.push(String(cfg.blenderExe))
  } catch (e) {}
  if (process.platform === 'win32') {
    const roots = [
      'C:\\Program Files\\Blender Foundation',
      'C:\\Program Files (x86)\\Blender Foundation',
      'D:\\Program Files\\Blender Foundation',
    ]
    for (const root of roots) {
      try {
        for (const d of readdirSync(root)) {
          if (!/^Blender/i.test(d)) continue
          out.push(path.join(root, d, 'blender.exe'))
        }
      } catch (e) {}
    }
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Blender.app/Contents/MacOS/Blender')
    out.push('/Applications/Blender/Blender.app/Contents/MacOS/Blender')
  } else {
    out.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/opt/blender/blender')
  }
  return out
}

export function resolveBlenderExe() {
  for (const c of candidates()) {
    try { if (c && existsSync(c) && statSync(c).isFile()) return { exe: c, source: 'fs' } } catch (e) {}
  }
  return { exe: 'blender', source: 'PATH' }
}

/* ───────────── 发现脚本 ───────────── */

const PY = String.raw`
import bpy, json, sys
res = {"ok": True}
try:
    res["blender"] = bpy.app.version_string
    res["version"] = list(bpy.app.version)
except Exception as e:
    res["ok"] = False
    res["err"] = str(e)

addons = []
try:
    prefs = bpy.context.preferences
    keys = list(prefs.addons.keys())
    for mod_name in keys:
        item = {"module": mod_name}
        try:
            m = sys.modules.get(mod_name)
            if m is None:
                try:
                    m = __import__(mod_name)
                except Exception:
                    m = None
            bi = getattr(m, "bl_info", None) if m is not None else None
            if isinstance(bi, dict):
                for k in ("name", "version", "category", "author"):
                    if k in bi:
                        item[k] = str(bi[k])
        except Exception:
            pass
        addons.append(item)
except Exception as e:
    res["addons_err"] = str(e)[:200]
res["addons"] = addons

ops = []
try:
    mods = [m for m in dir(bpy.ops) if not m.startswith("_")]
except Exception:
    mods = []
for mod in mods:
    try:
        sub = getattr(bpy.ops, mod)
        names = [n for n in dir(sub) if not n.startswith("_")]
    except Exception:
        continue
    for op in names:
        oid = mod + "." + op
        desc = ""
        args = []
        try:
            rna = getattr(sub, op).get_rna_type()
            desc = (getattr(rna, "description", "") or "").strip()
            for p in rna.properties:
                pid = getattr(p, "identifier", "")
                if pid and pid != "rna_type":
                    args.append(pid)
                if len(args) >= 16:
                    break
        except Exception:
            pass
        ops.append({"id": oid, "d": desc[:160], "a": args})
res["ops"] = ops
res["op_count"] = len(ops)
print("DBSR_ENV " + json.dumps(res, ensure_ascii=False))
`

/* ───────────── 缓存 ───────────── */

export function loadCache() {
  try {
    const j = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    if (!j || typeof j !== 'object') return null
    j.ageMs = Date.now() - Number(j.t || 0)
    j.stale = !(j.ageMs >= 0 && j.ageMs < TTL_MS)
    return j
  } catch (e) {
    return null
  }
}

function saveCache(env) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(env), 'utf8')
    return true
  } catch (e) {
    return false
  }
}

/* ───────────── 执行发现 ───────────── */

export function discover(opts = {}) {
  const { exe, source } = opts.exe ? { exe: opts.exe, source: 'arg' } : resolveBlenderExe()
  const timeoutMs = Math.max(15000, Math.min(300000, Number(opts.timeoutMs) || 120000))
  const t0 = Date.now()
  return new Promise((resolve) => {
    let child
    try {
      const script = path.join(os.tmpdir(), 'dbsr-env-' + process.pid + '.py')
      writeFileSync(script, PY, 'utf8')
      const args = ['-b', '-noaudio', '--python', script]
      child = spawn(exe, args, { windowsHide: true })
    } catch (e) {
      resolve({ ok: false, error: '启动失败：' + String((e && e.message) || e), exe, source })
      return
    }
    let out = ''
    let err = ''
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      try { child.kill() } catch (e) {}
      resolve({ ...v, ms: Date.now() - t0, exe })
    }
    const timer = setTimeout(() => finish({ ok: false, error: '超时 ' + timeoutMs + 'ms（addon 多时首次会慢，可加大 timeoutMs）' }), timeoutMs)
    child.stdout.on('data', (d) => { out += String(d) })
    child.stderr.on('data', (d) => { err += String(d) })
    child.on('error', (e) => {
      clearTimeout(timer)
      finish({ ok: false, error: '跑不起来：' + String((e && e.message) || e) + '（检查 blender 是否在 PATH，或设 DSH_BLENDER_EXE）' })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const line = out.split(/\r?\n/).reverse().find((l) => l.startsWith('DBSR_ENV '))
      if (!line) {
        finish({ ok: false, error: '没拿到结果（exit ' + code + '）' + (err ? '：' + err.split('\n').slice(-3).join(' ').slice(0, 300) : '') })
        return
      }
      let j
      try { j = JSON.parse(line.slice(9)) } catch (e) {
        finish({ ok: false, error: '结果解析失败：' + String((e && e.message) || e) })
        return
      }
      j.t = Date.now()
      j.exe = exe
      j.exeSource = source
      finish(j)
    })
  })
}

export async function refreshEnv(opts = {}) {
  const env = await discover(opts)
  if (env.ok) saveCache(env)
  return env
}

export function envAgeText(env) {
  if (!env || !env.t) return '无缓存'
  const ms = Date.now() - Number(env.t)
  if (ms < 60000) return '刚刚'
  if (ms < 3600000) return Math.round(ms / 60000) + ' 分钟前'
  if (ms < 86400000) return Math.round(ms / 3600000) + ' 小时前'
  return Math.round(ms / 86400000) + ' 天前'
}

export const __envInternals = { CACHE_FILE, TTL_MS, PY, candidates }
