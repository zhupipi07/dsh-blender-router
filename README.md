# dsh-blender-router

> 让 DSH 里的 AI 真正用上 Blender 插件的**全部能力面**，而不是只会 `primitive_cube_add`。

配套 [`dsh-blender-plugin`](https://github.com/sixtysevenlf/dsh-blender-plugin)（28 个能力族 / 186 个 op）。

---

## 它解决什么问题

装了 dsh-blender-plugin 之后，AI 仍然可能只用最基础的方块建模。原因不是权限，是**可发现性**：

- 186 个 op 藏在 `blender_rt_plan(op="catalog")` 里，一次输出约 11 KB —— 模型不主动查就永远看不见；
- 随包 skill 约 125 KB（≈27k tokens），模型倾向不加载；
- 于是默认路径退回 `blender_rt_do` + `primitive_cube_add`，也就是"只用了 1/186"。

本插件做三件事：

| 能力 | 是什么 |
|---|---|
| `blender_route(intent)` | 意图 → 该用哪个能力族 / 哪条入口链。一次调用替代读 11 KB 目录 |
| `blender_coverage(days)` | 读插件自己的 trajectory 日志，统计**真的用了几种**（用了几个 family、最常用 op、哪些没用过、plan 占比） |
| 随包 skill `blender-toolrouter` | 开工协议：三步法、工具层选择、禁手写清单、交付三道门 |

再加一份可选的 `AGENTS.md` 路由表（约 900 tokens），常驻在模型每次请求的上下文里——因为"每轮都看得见"比"想起来加载"可靠一个量级。

## 效果

给模型一个"做个齿轮"，它不再从方块拉，而是：

```
blender_route(intent="做个齿轮")
→ generator · 参数化重复件  [匹配 5.2 · 命中 齿轮]
   入口链：generator_save → generator_run → generator_diff
   别用：别写一次性 for 循环；要改参用 generator_save → run
```

然后 `blender_rt_plan(op="catalog", args={family:"generator"})` 拿精确参数，照骨架跑。

## 安装

### 1) 装插件

```bash
# 从 GitHub
dsh plugin --profile web add github:<you>/dsh-blender-router

# 或本地目录（开发）
dsh plugin --profile web add .
```

装完**重启 DSH**，新会话里应出现 `blender_route` / `blender_coverage` 两个工具，技能目录里出现 `blender-toolrouter`。

### 2) 装常驻路由表（推荐）

把仓库里的 [`AGENTS.md`](./AGENTS.md) 合并进：

- 全局：`~/.dsh/AGENTS.md`（所有会话生效，约 900 tokens）
- 或某个项目：`<项目根>/AGENTS.md`（只在该项目生效）

文件带 `<!-- dsh-blender-router:begin -->` 标记，已有 AGENTS.md 时只把标记之间那段粘进去即可。**新开会话生效**（baseline 在会话第一次请求时加载）。

### 3) 验证

```
blender_route(intent="*")          # 应该列出 28 个 family
blender_coverage(days=7)           # 应该报出「能力面覆盖 N/28 family」
```

`blender_coverage` 的日志位置：`<workDir>/trajectory/*.jsonl`，`workDir` 取自 `~/.dsh/dsh-blender.config.json`，也可用环境变量 `DSH_BLENDER_WORKDIR` 或入参 `dir` 指定。

## 设计取舍

- **不做硬拦截。** 不做"不跑 audit 就不许导出"这种门。经验：硬门只能保证"跑过"，保证不了"跑好"，还会把重试成本转嫁给用户。
- **不做工具包装。** 不代理 dsh-blender-plugin 的任何调用，只做索引与统计——所以两个插件升级互不阻塞。
- **全部降级安全。** 拿不到 `@deepseek-ai/dsh-tools`、没有 tools 服务、索引缺失、日志不存在，都只告警，不会弄挂宿主。
- **统计只读插件自己的日志。** 不需要 hook 宿主，不增加运行时开销。

## 目录

```
src/index.js                 两个工具 + skill provider（纯 ESM，无构建步骤）
data/ops-index.json          28 family / 186 op 的索引（与插件目录对齐）
skills/blender-toolrouter/   随包 skill
AGENTS.md                    常驻路由表（可选装）
tests/                       零依赖自测（node tests/*.mjs）
```

## 自测

```bash
node tests/index.test.mjs     # 索引完整性（28 family / 186 op / 字段齐全）
node tests/route.test.mjs     # 意图路由（10 条真实意图 + 全表 + 无命中退路）
node tests/coverage.test.mjs  # 读真实 trajectory，统计口径
```

## 已知边界

- 路由是**关键词 + 字符二元组**匹配，不是语义模型；命中率靠 `data/ops-index.json` 的 `kw` 词表维护。遇到不认识的意图，最可靠的做法仍是 `intent="*"` 看全表。
- 索引基于 `dsh-blender-plugin v2.5.0`（186 op）。插件升级后 op 名单可能变，`blender_route` 只给"族"和"入口链"，精确参数始终以 `catalog` 为准。
- 它提高"想到用某个能力"的概率，不提高模型本身的美术判断。

## License

MIT
