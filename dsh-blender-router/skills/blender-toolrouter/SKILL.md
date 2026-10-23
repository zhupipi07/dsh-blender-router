---
name: blender-toolrouter
description: Blender 任务的开工协议与能力路由。做 Blender 建模、改模、装配、材质、UV、渲染、导出、参考图还原、雕刻、扫掠、机构、3D 打印检查之前先读。解决「模型只会 primitive_cube_add、插件 28 family/186 op 用不上」：给意图→能力族的路由、工具层选择、禁手写清单、交付前三道门与 op 使用台账。
---

# Blender 能力路由（开工协议）

配合 `dsh-blender-plugin`（28 family / 186 op）。默认失败模式：模型只调 `rt_do` 写 `primitive_cube_add`，把其余能力当不存在。本协议治这个。

## 0. 开工三步（别跳）

1. `blender_rt_cmd(name="get_scene_info")` —— 认现场：已有什么、单位、集合。
2. **先路由**：调 `blender_route(intent="<你要做的事>")`，拿到该用的 family 与入口链；再 `blender_rt_plan(op="catalog", args={family:"…"})` 看精确参数。
3. 小步执行：`blender_rt_do(code=…, see=true)` 改一步看一眼；批量才切 `blender_rt_headless`。

> 跳过第 2 步 = 退回手写 bpy = 用户抱怨的那个现象。

## 0.1 环境会变：先问机器，再问表

静态 family 表只管「dsh-blender-plugin 有什么」；**用户 Blender 里装了什么，只有机器知道**（各家 addon 不同、版本不同）。

- 首次 / 换机器 / 装了新 addon / 升级 Blender：`blender_env(refresh=true)`（约 10–60 秒，缓存 12 小时）。
- 平时：`blender_route(intent=…)` 在给出 family 之后，会附一段「原生 / 第三方算子」——来自真实 `bpy.ops`，包括 addon 命名空间（如 `mmd_tools.*`、`kkbp.*`）。
- 缓存过期、或 Blender 版本变了：再 refresh 一次。
- 找不到 Blender：设环境变量 `DSH_BLENDER_EXE`，或给 `exe=…`。

> 判断依据：`blender_env` 报的 `Blender 版本 + addon 数 + 算子数`。这三个数变了，索引就该重扫。

## 1. 意图 → family 速查

| 意图 | family / 入口链 |
|---|---|
| 参考图/截图还原外形 | `shape`：shape_draft → shape_draft_check → shape_plan → shape_sections → shape_loft |
| 车壳、轮眉、包络比例 | `vehicle`：vehicle_sections → vehicle_loft → vehicle_panels；`clearance`：clear_check |
| 人形素体、头型、比例 | `human`：human_base / human_spec / human_head / human_measure |
| 脸部比例 | `face`：face_ratios / face_compare |
| 量图：尺寸/取色/裁切/差分 | `img`：img_scan / img_rectify / img_crop / img_diff |
| 雕刻体积、表面起伏 | `sculpt`：sculpt_scan → sculpt_setup → sculpt_apply |
| 管路、线缆、轨道 | `sweep`：sweep_analyze → sweep_build |
| 履带、链节、齿圈、阵列 | `generator`：generator_save → generator_run |
| 程序化材质、烘贴图 | `material`：material_build → material_apply → material_bake |
| UV、带贴图交付 | `uv`：uv_smart_project → uv_stats → uv_pack |
| 穿模/连通/包络/浮块 | `audit`：audit_mesh / audit_scene / audit_interference / audit_connectivity / audit_gate |
| 3D 打印（壁厚/悬垂） | `print`：print_report |
| 修模、减面 | `fix`：fix_repair / fix_decimate |
| 与参考图比对 | `qc`：qc_compare / qc_metrics；多视角 `qc_render`：qc_render_views |
| 拼图看证据 | `montage` |
| 导出交付 | `deliver`：deliver_export → deliver_verify |
| 机构、铰接、URDF | `motion`：motion_joints → motion_measure → motion_export_urdf |
| 验收判据固化 | `gate`：gate_plan → gate_run |
| 多步链编排 | `pipe`：pipe_run |
| 成对间隙 | `clearance`：clear_check |
| 外部独立复核 | `ext`：gltf_validate / ext_mesh_check |
| 先判定再动手 | `plan` / `contract` |
| 真 UI 上下文 | `gui`：gui_frame / gui_shading / gui_open |
| 渲染卡住/排队 | `render_guard` / `render` |

## 2. 工具层怎么选（选错层白跑）

| 场合 | 工具 |
|---|---|
| 迭代改形、看一眼 | `blender_rt_do`（+`see=true`） |
| 批量、脚本、不用看 | `blender_rt_headless` |
| 同脚本反复跑 | `blender_rt_worker` |
| >1 分钟 / 大渲染 | `blender_rt_job(op="start")` → `wait` |
| 拓扑改动前 | `blender_rt_txn(op="snapshot")` |
| 参数组合复用 | `blender_rt_preset` |

## 3. 禁手写清单

- 导出 → `deliver_export`（别 `bpy.ops.export_scene.*`）
- 材质节点树 → `material_build(preset=…)`
- 放样站表 → `shape_plan` / `vehicle_*`
- 参数化循环 → `generator_save`
- UV 摆放 → `uv_smart_project`
- 用眼睛验收 → `qc_compare`（IoU / 剖面差）

## 4. 交付前三道门

1. `audit_mesh(objects=[...])` —— 零穿模、零孤立点、法线一致。
2. `qc_render_views(...)` —— 出对照图；必要时 `qc_compare(ref=…)`。
3. `deliver_verify(...)` —— 导出物回读，manifest md5 对得上。

## 5. 用完了吗？看数字

`blender_coverage(days=7)` 会读插件自己的 trajectory 日志，告诉你：用了几个 family（共 28）、最常用 op、哪些没用过、plan 调用占比。低于 4 个 family 就说明还在走"方块路线"。

## 6. 台账（可选，给自己看）

任务结束追加一行到 `blender-ops.log`：

```
2026-10-21 | 齿轮道具 | families: sculpt,uv,deliver | ops: sculpt_apply,uv_smart_project,deliver_export,deliver_verify
```
