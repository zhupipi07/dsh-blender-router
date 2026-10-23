<!-- dsh-blender-router:begin -->
## Blender 任务：先路由，再动手

装了 `dsh-blender-plugin` 就有 28 个能力族 / 186 个 op。**默认错误是只拿 `primitive_cube_add` 开工**——那只是其中一两个。

**开工三步**：① `blender_rt_cmd(name="get_scene_info")` 认现场 → ② `blender_route(intent="你要做的事")` 选能力族和真实算子（或 `blender_rt_plan(op="catalog")` 查全表）→ ③ `blender_rt_do(..., see=true)` 改一步看一眼。

> 环境和 addon 会变（各家装的插件不同、Blender 版本也不同）。第一次开工、或换了机器/装了新 addon 之后，先调 `blender_env`（`refresh=true` 重扫，约 10–60 秒，缓存 12 小时）——`blender_route` 会从你**真实装的** addon 和 `bpy.ops` 里挑算子，而不是照一张写死的表。

| 你要做的事 | 入口链 |
|---|---|
| 参考图 / 截图还原外形 | `shape_draft → shape_draft_check → shape_plan → shape_sections → shape_loft` |
| 车壳 / 轮眉 / 包络 | `vehicle_sections → vehicle_loft → vehicle_panels` · `clear_check` |
| 人形素体 / 头型 | `human_base` / `human_spec` / `human_head` |
| 雕刻体积、表面起伏 | `sculpt_scan → sculpt_setup → sculpt_apply` |
| 管路 / 线缆 / 轨道 | `sweep_analyze → sweep_build` |
| 履带 / 链节 / 齿圈 / 阵列 | `generator_save → generator_run` |
| 程序化材质 / 烘贴图 | `material_build → material_apply → material_bake` |
| UV / 带贴图交付 | `uv_smart_project → uv_stats → uv_pack` |
| 穿模 / 连通 / 包络 / 浮块 | `audit_mesh` / `audit_scene` / `audit_interference` / `audit_gate` |
| 3D 打印壁厚 / 悬垂 | `print_report` |
| 修模 / 减面 | `fix_repair` / `fix_decimate` |
| 和参考图比对 | `qc_compare` · 多视角 `qc_render_views` |
| 导出交付 | `deliver_export → deliver_verify` |
| 机构 / URDF | `motion_joints → motion_measure → motion_export_urdf` |
| 验收判据固化 | `gate_plan → gate_run` |
| 量图（尺寸/取色/差分） | `img_scan` / `img_rectify` / `img_diff` |

**四条规矩**

1. 不确定就查：`blender_rt_plan(op="catalog", args={family:"sculpt"})`，每族带「骨架 / 别用」。
2. 别手写这四样：导出（`deliver_*`）、材质节点树（`material_build`）、放样站表（`shape_plan` / `vehicle_*`）、参数化循环（`generator_*`）。
3. 工具层按场合选：改一步看一眼用 `blender_rt_do`；批量用 `blender_rt_headless`；同脚本反复跑用 `blender_rt_worker`；超过 1 分钟用 `blender_rt_job`；拓扑改动前 `blender_rt_txn(snapshot)`。
4. 交付前跑三道：`audit_mesh` → `qc_render_views` → `deliver_verify`；想知道到底用了几种能力就调 `blender_coverage`。
<!-- dsh-blender-router:end -->
