# 在 Codex / Claude Code / Cursor 里用

这些宿主没有 DSH 的插件系统，所以本插件提供一个**独立命令行**：`blender-router`。
它读同一份能力索引（28 族 / 186 op）和同一份环境快照，只是把「调用」换成「打印」。

## 1. 装 CLI

仓库里已带 `bin/blender-router.mjs`，只要 Node ≥ 20：

```bash
node /path/to/dsh-blender-router/bin/blender-router.mjs --help
```

想让它变成全局命令 `blender-router`，在 PATH 上的目录（如 `npm config get prefix` 指向的 bin 目录）里放一个 shim：

Windows `blender-router.cmd`：

```bat
@echo off
node "C:\path\to\dsh-blender-router\bin\blender-router.mjs" %*
```

macOS / Linux `blender-router`（chmod +x）：

```sh
#!/bin/sh
exec node /path/to/dsh-blender-router/bin/blender-router.mjs "$@"
```

> Windows 提示：如果仓库路径里有中文（如 `D:\项目\...`），建议建一个 ASCII 的目录联接再指过去，
> 避免某些 shell 对 `%*` 传参的编码差异。

## 2. 装 skill

把 `skills/blender-toolrouter/SKILL.md` 复制到宿主的技能目录，或直接软链整个目录：

| 宿主 | 技能目录 |
|---|---|
| Codex | `~/.codex/skills/blender-toolrouter/SKILL.md` |
| Claude Code | `~/.claude/skills/blender-toolrouter/SKILL.md` |
| Cursor | 用 `AGENTS.md` 段落代替（见下） |

Codex 版 skill 已按「CLI + bpy 脚本」改写（仓库里的那份面向 DSH 工具面），两者内容同源、不冲突。

## 3. 常驻提醒（可选）

把下面这段合并进宿主的全局指令文件，让模型每次都看得见：

- Codex：`~/.codex/AGENTS.md`
- Claude Code：`~/.claude/CLAUDE.md`
- 项目级：仓库根 `AGENTS.md`

```markdown
## Blender 任务：先路由，再动手
1. `blender-router route "<你要做的事>"` → 能力方向 + 本机真实 bpy.ops
2. 写 bpy 脚本，`blender-router run build.py` 执行
3. 装了新 addon / 升级 Blender：`blender-router env --refresh`
```

## 4. 命令

```bash
blender-router route "挖个孔"          # 意图 → 能力族 + 本机算子（含参数名）
blender-router route "*"               # 列出 28 个能力族
blender-router env                     # 版本 / addon / 算子数（缓存 12 小时）
blender-router env --refresh           # 重扫
blender-router run build.py            # blender -b --python build.py
blender-router coverage --days 7       # 若同时装着 dsh-blender-plugin，读它的调用日志
blender-router route "展UV" --json     # 机器可读
```

## 与 DSH 版的差别

| | DSH 插件 | CLI |
|---|---|---|
| 调用方式 | 工具 `blender_route` / `blender_env` | `blender-router route` / `env` |
| 执行 | `blender_rt_do`（GUI 实时）/ `blender_rt_headless` | `blender-router run`（无头） |
| 实时视口 | 有（`blender_rt_see`） | 无，靠渲染出图 |
| 环境扫描 | 同一个 Python 脚本 | 同 |
