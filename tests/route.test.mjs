import { __internals } from '../src/index.js'

const { route } = __internals
let failed = 0
const cases = [
  ['做个齿轮', 'generator'],
  ['照着这张截图还原外形', 'shape'],
  ['导出 glb 给 Unity', 'deliver'],
  ['检查一下有没有穿模', 'audit'],
  ['贴个金属拉丝材质', 'material'],
  ['做一条管路', 'sweep'],
  ['做个人形素体', 'human'],
  ['这个件能不能 3D 打印', 'print'],
  ['轮子和轮眉之间留间隙', 'clearance'],
  ['展个 UV 再导出', 'uv'],
]

for (const [intent, want] of cases) {
  const r = route(intent, 3)
  const fams = r.families || []
  const hit = fams.includes(want)
  if (!hit) { failed++; console.error('FAIL "' + intent + '" 期望含 ' + want + '，实际 ' + JSON.stringify(fams)) }
  else console.log('ok   "' + intent + '" → ' + fams.join(' / '))
}

const star = route('*', 3)
if (!star.families || star.families.length !== 28) { failed++; console.error('FAIL intent="*" 应返回 28 个 family') }
else console.log('ok   intent="*" 返回全表 28')

const empty = route('asdfghjkl', 3)
if (empty.ok) { failed++; console.error('FAIL 无命中时应 ok=false') }
else console.log('ok   无命中给可读退路')

console.log(failed ? `\n${failed} 项失败` : '\nroute 检查通过')
process.exit(failed ? 1 : 0)
