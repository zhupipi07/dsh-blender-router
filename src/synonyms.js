/**
 * 中文意图 → Blender 算子英文词 的同义词表。
 *
 * 为什么需要：bpy.ops 的描述是英文（"Add a bevel modifier"），用户说的是「倒个角」。
 * 这张表是路由的翻译层，**它不是算子清单** —— 算子永远从运行时环境里读，
 * 这里只负责把「用户的话」翻译成「可能出现在算子 id / 描述里的词」。
 */

export const CONCEPTS = [
  { zh: ['倒角', '圆角', '倒个角'], en: ['bevel', 'chamfer'], mod: 'BEVEL' },
  { zh: ['挖孔', '开孔', '打孔', '打洞', '挖洞'], en: ['boolean', 'hole', 'cut', 'difference', 'punch'], mod: 'BOOLEAN' },
  { zh: ['布尔'], en: ['boolean'], mod: 'BOOLEAN' },
  { zh: ['挤出'], en: ['extrude'] },
  { zh: ['内插', '内缩', '嵌入'], en: ['inset'] },
  { zh: ['阵列', '复制一排'], en: ['array', 'duplicate', 'instance'], mod: 'ARRAY' },
  { zh: ['镜像', '对称'], en: ['mirror', 'symmetrize'], mod: 'MIRROR' },
  { zh: ['细分', '加面'], en: ['subdivide', 'subdivision', 'subsurf'], mod: 'SUBSURF' },
  { zh: ['平滑', '光滑', '着色'], en: ['smooth', 'shade', 'auto smooth'] },
  { zh: ['合并', '合起来'], en: ['join', 'merge'] },
  { zh: ['分离', '拆开'], en: ['separate'] },
  { zh: ['切割', '切分', '切开'], en: ['knife', 'bisect', 'cut'] },
  { zh: ['桥接'], en: ['bridge'] },
  { zh: ['焊接', '合并点'], en: ['weld', 'merge by distance', 'remove doubles'], mod: 'WELD' },
  { zh: ['重拓扑', '重网格'], en: ['remesh', 'retopo', 'quadriflow'], mod: 'REMESH' },
  { zh: ['加厚', '厚度', '实心'], en: ['solidify', 'thickness'], mod: 'SOLIDIFY' },
  { zh: ['螺旋', '车削'], en: ['screw', 'spin', 'lathe'], mod: 'SCREW' },
  { zh: ['硬表面', '倒角权重'], en: ['weighted normal', 'bevel weight'], mod: 'WEIGHTED_NORMAL' },
  { zh: ['雕刻', '雕'], en: ['sculpt', 'brush'] },
  { zh: ['遮罩'], en: ['mask'] },
  { zh: ['管道', '管子', '管'], en: ['pipe', 'tube', 'curve'] },
  { zh: ['曲线', '样条'], en: ['curve', 'bezier', 'spline'] },
  { zh: ['放样', '扫掠', '车削', '旋转成形'], en: ['loft', 'sweep', 'spin', 'screw', 'lathe'] },
  { zh: ['文字', '字体'], en: ['text', 'font'] },
  { zh: ['地形', '地貌'], en: ['terrain', 'landscape', 'displace'] },
  { zh: ['材质', '着色器', '上色'], en: ['material', 'shader', 'principled', 'color'] },
  { zh: ['节点', '几何节点'], en: ['node', 'geometry nodes'] },
  { zh: ['贴图', '纹理'], en: ['texture', 'image', 'uv map'] },
  { zh: ['uv', '展开', '展uv'], en: ['uv', 'unwrap', 'smart project', 'seam'] },
  { zh: ['法线', '翻面'], en: ['normal', 'flip', 'recalculate'] },
  { zh: ['顶点色', '颜色属性'], en: ['color attribute', 'vertex color'] },
  { zh: ['权重', '蒙皮'], en: ['weight', 'vertex group', 'skin'] },
  { zh: ['骨骼', '绑定', '骨架'], en: ['armature', 'bone', 'rig'] },
  { zh: ['姿态', '姿势'], en: ['pose'] },
  { zh: ['动画', '关键帧', '动作'], en: ['keyframe', 'animation', 'action'] },
  { zh: ['约束'], en: ['constraint'] },
  { zh: ['物理', '刚体', '布料', '破碎'], en: ['rigid body', 'cloth', 'physics', 'fracture'] },
  { zh: ['粒子', '散布'], en: ['particle', 'scatter', 'hair'] },
  { zh: ['流体', '水', '烟雾', '火'], en: ['fluid', 'smoke', 'fire', 'liquid'] },
  { zh: ['相机', '镜头'], en: ['camera', 'lens'] },
  { zh: ['灯光', '打光', '照明'], en: ['light', 'lamp', 'area'] },
  { zh: ['渲染', '出图'], en: ['render', 'eevee', 'cycles'] },
  { zh: ['合成', '后期'], en: ['compositor', 'compositing'] },
  { zh: ['导入'], en: ['import'] },
  { zh: ['导出'], en: ['export'] },
  { zh: ['打印', '3d打印', 'stl'], en: ['stl', '3d print', 'export_mesh'] },
  { zh: ['测量', '量一下'], en: ['measure', 'ruler'] },
  { zh: ['对齐'], en: ['align'] },
  { zh: ['吸附'], en: ['snap'] },
  { zh: ['原点'], en: ['origin'] },
  { zh: ['变换', '移动', '旋转', '缩放'], en: ['transform', 'translate', 'rotate', 'scale'] },
  { zh: ['父子', '父级'], en: ['parent'] },
  { zh: ['顶点', '边', '面'], en: ['vertex', 'edge', 'face'] },
  { zh: ['环切'], en: ['loop cut', 'loopcut'] },
  { zh: ['减面', '精简'], en: ['decimate', 'reduce'] },
  { zh: ['平滑着色', '自动平滑'], en: ['shade smooth', 'auto smooth'] },
  { zh: ['展开图', '贴图坐标'], en: ['uv', 'unwrap'] },
  { zh: ['组', '集合'], en: ['collection', 'group'] },
]

/** 去掉中文口语填充字，让「挖个孔」「加厚一点」也能命中词表 */
function normZh(s) {
  return String(s || '').toLowerCase().replace(/[个一点下些]/g, '')
}

/** 从中文/英文意图里抽出「可能出现在算子 id 或描述里」的词 */
export function expandIntent(text) {
  const q = String(text || '').toLowerCase()
  const qn = normZh(q)
  const tokens = new Set()
  const hits = []
  for (const c of CONCEPTS) {
    for (const zh of c.zh) {
      if (q.includes(zh) || qn.includes(normZh(zh))) {
        hits.push(zh)
        for (const en of c.en) tokens.add(en)
        break
      }
    }
  }
  // 原文里的英文词也直接用（用户可能直接说 bevel / unwrap）
  for (const w of q.split(/[^a-z0-9_]+/)) {
    if (w.length >= 3 && !/^(the|and|for|with|this|that|make|add)$/.test(w)) tokens.add(w)
  }
  return { tokens: [...tokens], hits }
}

const CORE_BOOST = { object: 0.4, mesh: 0.4, curve: 0.3, sculpt: 0.3, uv: 0.3, node: 0.2, armature: 0.2 }

/** 在「运行时环境」的算子表里找匹配项 */
export function matchOps(intent, env, k = 6) {
  if (!env || !Array.isArray(env.ops) || !env.ops.length) return { ok: false, items: [] }
  const q = String(intent || '').toLowerCase()
  const qn = normZh(q)
  const { tokens, hits } = expandIntent(intent)
  const mods = new Set()
  for (const c of CONCEPTS) {
    if (!c.mod) continue
    if (c.zh.some((zh) => q.includes(zh) || qn.includes(normZh(zh)))) mods.add(c.mod)
  }
  const hasModAdd = env.ops.some((o) => o.id === 'object.modifier_add')
  const modItems = (mods.size && hasModAdd)
    ? [...mods].slice(0, 3).map((t) => ({ id: 'object.modifier_add', a: ['type'], d: 'Add a procedural modifier', mod: t, score: 999 }))
    : []
  if (!tokens.length) return { ok: true, items: modItems.slice(0, k), tokens, hits }
  const scored = []
  for (const op of env.ops) {
    const id = String(op.id || '')
    const idWords = id.toLowerCase()
    const desc = String(op.d || '').toLowerCase()
    const args = Array.isArray(op.a) ? op.a.join(' ').toLowerCase() : ''
    let score = 0
    for (const t of tokens) {
      if (idWords.includes(t)) score += 3
      else if (desc.includes(t)) score += 1.5
      if (args.includes(t)) score += 0.8
    }
    if (!score) continue
    const mod = id.split('.')[0]
    score += CORE_BOOST[mod] || 0
    if (mod === 'wm') score -= 0.6
    if (/^_/.test(String(op.id))) score -= 5
    if (score >= 2) scored.push({ ...op, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const seen = new Set(modItems.map((m) => m.id + ':' + m.mod))
  const items = [...modItems]
  for (const s of scored) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    items.push(s)
    if (items.length >= Math.max(1, Math.min(20, k))) break
  }
  return { ok: true, items: items.slice(0, Math.max(1, Math.min(20, k))), tokens, hits, mods: [...mods] }
}

export function describeOp(op) {
  if (op.mod) return `bpy.ops.object.modifier_add(type="${op.mod}")  — ${op.mod} 修改器（加完再调它的属性）`
  const args = Array.isArray(op.a) && op.a.length ? '（参数：' + op.a.slice(0, 8).join(', ') + '）' : ''
  return `bpy.ops.${op.id}()${args}` + (op.d ? '  — ' + op.d : '')
}
