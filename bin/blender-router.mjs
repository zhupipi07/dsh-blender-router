#!/usr/bin/env node
/**
 * blender-router —— 不依赖 DSH 的命令行入口。
 *
 * 给 Codex / Claude Code / Cursor 这类「有 shell 但没有 DSH 插件系统」的宿主用：
 *   blender-router route "倒个角"      意图 → 能力族 + 本机真实算子
 *   blender-router env [--refresh]     扫描/查看本机 Blender 环境
 *   blender-router coverage [--days 7] 读 dsh-blender-plugin 的 trajectory 统计
 *   blender-router run script.py       用本机 Blender 无头跑脚本（blender -b --python）
 *
 * 全局参数：--json 输出结构化结果
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.resolve(HERE, '..', 'src', 'index.js')

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const args = argv.filter((a) => a !== '--json')
const cmd = args[0]

function flag(name, fallback) {
  const i = args.indexOf(name)
  if (i < 0) return fallback
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}

async function main() {
  const core = await import('file://' + CORE.replace(/\\/g, '/'))
  const I = core.__internals
  const envMod = await import('file://' + path.resolve(HERE, '..', 'src', 'env.js').replace(/\\/g, '/'))

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(`blender-router — Blender 能力路由（无宿主依赖）

用法：
  blender-router route "<你要做的事>" [--k 3]     能力族 + 本机真实算子
  blender-router env [--refresh]                 扫描/查看 Blender 环境（版本/addon/算子）
  blender-router coverage [--days 7] [--dir x]    dsh-blender-plugin 的能力使用统计
  blender-router run <script.py> [--timeout ms]   用本机 Blender 无头跑脚本
  blender-router route "*"                        列出全部 28 个能力族

全局：--json 输出 JSON`)
    return 0
  }

  if (cmd === 'route') {
    const intent = args[1] || '*'
    const r = I.route(intent, Number(flag('--k', 3)))
    // CLI 宿主（Codex / Claude Code）没有 DSH 的 plan/rt_do 工具：把提示换成 bpy 脚本口径
    const text = r.text
      .replace(/下一步：blender_rt_plan\(op="catalog", args=\{family:"([^"]+)"\}\) 拿精确参数，再照骨架调用/g,
        '下一步：按这条链写 bpy 脚本（算子名与参数以 `blender-router env` 的算子表为准）')
      .replace(/blender_rt_do\(code="bpy\.ops\.<上面某个>\(\)"\)；参数名照括号，值自己填。/g,
        '写进脚本后用 `blender-router run` 执行；参数名照括号，值自己填。')
      .replace(/提示：参数名写错会报「不认识的参数」；不确定就先用 catalog 展开该 family。/g,
        '提示：上面的 family op 名属于 DSH 插件；Codex 里请用「原生 / 第三方算子」给出的 bpy.ops 实现同样的事。')
    if (asJson) console.log(JSON.stringify({ ok: r.ok, families: r.families, text }, null, 2))
    else console.log(text)
    return 0
  }

  if (cmd === 'env') {
    let env = envMod.loadCache()
    let scanned = false
    if (flag('--refresh', false) || !env) {
      const res = await envMod.refreshEnv({})
      if (!res.ok) {
        console.error('扫描失败：' + (res.error || '未知原因'))
        return 1
      }
      env = envMod.loadCache() || res
      scanned = true
    }
    const addons = Array.isArray(env.addons) ? env.addons : []
    const named = addons.map((a) => (a.name ? a.name + (a.version ? ' ' + a.version : '') : a.module))
    const out = {
      blender: env.blender || null,
      exe: env.exe || null,
      addons: addons.length,
      ops: Array.isArray(env.ops) ? env.ops.length : 0,
      age: envMod.envAgeText(env),
      stale: !!env.stale,
      scanned,
    }
    if (asJson) {
      console.log(JSON.stringify({ ...out, addonList: named }, null, 2))
    } else {
      console.log(`Blender ${out.blender || '?'} · ${out.exe || '?'}`)
      console.log(`addon ${out.addons} 个${named.length ? '：' + named.slice(0, 20).join(' · ') : ''}`)
      console.log(`算子 ${out.ops} 个`)
      console.log(`缓存：${scanned ? '刚扫描' : out.age}${out.stale ? '（已过期，建议 --refresh）' : ''}`)
    }
    return 0
  }

  if (cmd === 'coverage') {
    const days = Number(flag('--days', 7)) || 7
    const dirArg = flag('--dir', null)
    const dir = I.resolveTrajectoryDir(typeof dirArg === 'string' ? dirArg : undefined)
    if (!dir) {
      console.error('找不到 trajectory 目录。传 --dir <workDir>/trajectory，或设 DSH_BLENDER_WORKDIR。')
      return 1
    }
    const r = I.coverageText(dir, days, Number(flag('--top', 10)) || 10)
    if (asJson) console.log(JSON.stringify({ ok: r.ok, familiesUsed: r.familiesUsed, familiesTotal: r.familiesTotal, text: r.text }, null, 2))
    else console.log(r.text)
    return r.ok ? 0 : 1
  }

  if (cmd === 'run') {
    const script = args[1]
    if (!script || !existsSync(script)) {
      console.error('用法：blender-router run <script.py>')
      return 1
    }
    const { exe } = envMod.resolveBlenderExe()
    const timeout = Number(flag('--timeout', 300000)) || 300000
    const code = await new Promise((resolve) => {
      const p = spawn(exe, ['-b', '-noaudio', '--python', path.resolve(script)], { stdio: 'inherit' })
      const t = setTimeout(() => { try { p.kill() } catch (e) {} resolve(124) }, timeout)
      p.on('close', (c) => { clearTimeout(t); resolve(c ?? 1) })
      p.on('error', (e) => { clearTimeout(t); console.error('启动失败：' + e.message); resolve(1) })
    })
    return code
  }

  console.error('未知命令：' + cmd + '（试 blender-router --help）')
  return 1
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('出错：' + (e && e.stack || e))
  process.exit(1)
})
