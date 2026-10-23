import { __internals } from '../src/index.js'

const { resolveTrajectoryDir, summarize, coverageText } = __internals
let failed = 0
const ok = (cond, msg) => { if (!cond) { failed++; console.error('FAIL ' + msg) } else console.log('ok   ' + msg) }

const dir = resolveTrajectoryDir()
if (!dir) {
  console.log('skip 找不到 trajectory 目录（这台机器没装/没跑过 dsh-blender-plugin）')
  process.exit(0)
}
console.log('ok   解析到 trajectory：' + dir)

const s = summarize(dir, 3650, 10)
ok(typeof s.total === 'number', 'total 是数字')
ok(s.total > 0, '读到了历史调用（' + s.total + ' 条）')
ok(s.planCalls > 0, '其中有 plan 调用（' + s.planCalls + ' 条）')

const r = coverageText(dir, 3650, 10)
ok(r.ok === true, 'coverageText ok')
ok(/能力面覆盖/.test(r.text), '报告含「能力面覆盖」')
ok(/没用过/.test(r.text), '报告含「没用过」')
console.log('--- 报告预览 ---')
console.log(r.text.split('\n').slice(0, 6).join('\n'))

console.log(failed ? `\n${failed} 项失败` : '\ncoverage 检查通过')
process.exit(failed ? 1 : 0)
