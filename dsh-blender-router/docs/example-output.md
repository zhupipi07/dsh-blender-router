# 真实输出示例

以下都是在本机跑出来的原文（Blender 5.2.0 LTS，12 个 addon，2660 个算子）。
用途：让你在装之前就知道它会回什么、以及它和「写死的工具表」差在哪。

---

## 1. 意图 → 能力族（静态层，跨版本稳定）

```
> blender_route(intent="做个齿轮")

意图「做个齿轮」→ 命中 1 个 family（全表 28 个）：

1) generator · 参数化重复件（履带 / 链节 / 齿圈 / 阵列）   [匹配 3.0 · 命中 齿轮]
   什么时候用：重复出现的零件要能改参不改码：履带块、链节、齿圈、螺栓阵列、栏杆
   入口链：generator_save(name, code, params) → generator_run(name, args) → generator_diff
   别用：别写一次性 for 循环；要改参用 generator_save → run
   全部 op（7）：generator_save · generator_run · generator_list · generator_get · generator_diff · generator_selftest · generator_help
   下一步：blender_rt_plan(op="catalog", args={family:"generator"}) 拿精确参数，再照骨架调用

原生 / 第三方算子（Blender 5.2.0 LTS · 12 个 addon · 缓存 8 分钟前）：
  没匹配到具体算子（可能该走上面的能力族）。
```

## 2. 纯几何编辑 → 真实算子（运行时层，跟着环境变）

```
> blender_route(intent="倒个角")

没有 family 命中「倒个角」。
两种情况：① 这是纯几何编辑，直接用 blender_rt_do；② 换个说法（用动词+名词…），或用 intent="*" 看全表。

原生 / 第三方算子（Blender 5.2.0 LTS · 12 个 addon · 缓存 8 分钟前）：
  · bpy.ops.object.modifier_add(type="BEVEL")  — BEVEL 修改器（加完再调它的属性）
  · bpy.ops.mesh.bevel()（参数：offset_type, offset, profile_type, offset_pct, segments, profile, affect, clamp_overlap）  — Cut into selected items at an angle to create bevel or chamfer
  · bpy.ops.transform.edge_bevelweight()（参数：value, snap, release_confirm, use_accurate）  — Change the bevel weight of edges
  用法：blender_rt_do(code="bpy.ops.<上面某个>()")；参数名照括号，值自己填。
```

其它实测命中：

| 你说的 | 它给的 |
|---|---|
| 挖个孔 / 打个孔 | `bpy.ops.object.modifier_add(type="BOOLEAN")` + `mesh.intersect_boolean` |
| 加厚一点 | `bpy.ops.object.modifier_add(type="SOLIDIFY")` + `mesh.solidify` |
| 做个阵列 | `bpy.ops.object.modifier_add(type="ARRAY")` + `object.duplicate_move` |
| 展个 UV | `uv.unwrap` / `uv.mark_seam` / `uv.seams_from_islands` |

## 3. 环境快照

```
> blender_env

Blender 5.2.0 LTS · 可执行文件 C:\Program Files\Blender Foundation\Blender 5.2\blender.exe
addon 12 个：BioVision Motion Capture (BVH) format · Scalable Vector Graphics (SVG) 1.1 format · UV Layout · FBX format · glTF 2.0 format · Cycles Render Engine · Pose Library · Blender Extensions …
算子 2660 个
缓存刚刚

下一步：blender_route(intent="你要做的事") —— 它会同时给「能力族」和「你环境里真实存在的算子」。
```

> 第三方 addon 的命名空间也会出现（本机实测可见 `mmd_tools.*`、`kkbp.*`、`sej.*`、`dshbb.*`）。

## 4. 使用覆盖（读插件自己的日志）

```
> blender_coverage(days=7)

Blender 能力使用统计 · 最近 7 天 · 2 个活跃日 · 2 个日志文件
总调用 590 · 成功 570（97%）· 其中 plan 调用 5
能力面覆盖：2/28 family（7%）

用过（次数）：audit×1 · human×1
没用过：shape · vehicle · face · img · sculpt · sweep · generator · material · uv · print · fix · qc · qc_render · deliver · motion · gate · pipe · clearance · ext · plan · contract · calib · render_guard · render · gui · montage
最常用 op：catalog×2 · audit_connectivity×1 · help×1 · human_help×1
调用类型：headless×245 · act×124 · view×91 · wait×69 · doctor×16 · launchBlender×13 · cmd×9 · start×8

⚠ 只用到很少几个 family。下次开工前先用 blender_route 查一次意图，别默认从方块起步。
```

这组数字就是这套东西存在的理由：**590 次调用里，只有 5 次走了能力族。**
