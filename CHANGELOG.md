# Changelog

## 1.2.0 — 2026-10-23

给「没有 DSH 插件系统」的宿主（Codex / Claude Code / Cursor）用同一套能力。

- **新增 CLI `blender-router`**（`bin/blender-router.mjs`，零依赖）：
  - `route "<意图>"` 意图 → 能力族 + 本机真实 `bpy.ops`（输出自动换成 bpy 脚本口径）
  - `env [--refresh]` 扫描/查看本机 Blender 环境
  - `coverage [--days 7]` 读 dsh-blender-plugin 的调用日志
  - `run <script.py>` 无头执行（`blender -b --python`）
  - 全局 `--json`
- 新增 `docs/codex.md`：Codex / Claude Code 的 shim、skill、AGENTS 装法。
- addon 版本号改为点分格式（`1.0.1` 而不是 `(1, 0, 1)`）。
- 环境过期提示同时给出 CLI 写法。

## 1.1.0 — 2026-10-21

环境自适应（本轮核心）。

- **新增 `blender_env`**：启动独立 `blender -b` 进程，读用户偏好，dump「Blender 版本 + 已启用 addon + 全部 `bpy.ops`（id / 描述 / 参数名）」，缓存到 `~/.dsh/dsh-blender-router/env.json`（12 小时 TTL）。
  - 一次扫描约 10–60 秒（实测 Blender 5.2.0 + 12 addon → 2660 算子，2.1 秒）。
  - 不碰正在跑的 GUI 会话；失败只降级。
- **`blender_route` 变成两层**：静态「能力族」（跨版本稳定）+ 运行时「原生 / 第三方算子」（跟着环境变）。
- **新增 `src/synonyms.js`**：中文意图 → 算子词的翻译层（倒角→bevel、挖孔→boolean、展UV→unwrap…），带口语归一化（「挖个孔」「加厚一点」也能命中）。
- **修改器合成分行**：常见需求直接给 `bpy.ops.object.modifier_add(type="BEVEL"/"BOOLEAN"/"ARRAY"/"SOLIDIFY"/…)`，不依赖模型自己拼。
- 注册兜底：拿不到 `@deepseek-ai/dsh-tools` 时改为直接注册原始 spec，仍可加载。
- 新增 `tests/env.test.mjs`（含伪环境用例，不依赖真 Blender）。
- `AGENTS.md` 增加「环境会变，先问机器」段落；skill 增加 0.1 节。

## 1.0.0 — 2026-10-21

首个版本。

- `blender_route(intent, k)`：意图 → 能力族 / 入口链 / 别用 / 全 op，替代读 11 KB 的 `catalog`。
- `blender_coverage(days, dir, top)`：读 `dsh-blender-plugin` 的 `trajectory/*.jsonl`，统计 family 覆盖、常用 op、未用族、plan 占比。
- 随包 skill `blender-toolrouter`；可选 `AGENTS.md` 常驻路由表。
- `data/ops-index.json`：28 family / 186 op 索引（对齐 `dsh-blender-plugin` v2.5.0）。
