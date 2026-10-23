# dsh-blender-router

> Make a DSH agent actually use the whole Blender capability surface — and the user's real addons — instead of stopping at `primitive_cube_add`.

Works alongside [`dsh-blender-plugin`](https://github.com/sixtysevenlf/dsh-blender-plugin).

## Why

The 186 ops live behind `blender_rt_plan(op="catalog")`, an ~11 KB dump a model rarely reads. The bundled skill is ~125 KB (~27k tokens) and is usually skipped. The default path collapses to `blender_rt_do` + `primitive_cube_add` — roughly 1 op out of 186.

And no static table survives contact with real machines: everyone runs a different set of addons (MMD Tools, KKB, BoxCutter, Node Wrangler…) on a different Blender version.

## What it adds

| Surface | Purpose |
|---|---|
| `blender_route(intent, k)` | Intent → capability families, entry chain, pitfalls — **plus the operators that actually exist on this machine**. |
| `blender_env(refresh?, exe?, timeoutMs?)` | Scans the local Blender: version, enabled addons, every `bpy.ops` operator with its argument names. Cached 12 h. |
| `blender_coverage(days, dir, top)` | Reads the plugin's own `trajectory/*.jsonl` and reports real usage: families used / 28, top ops, unused families, plan share. |
| bundled skill `blender-toolrouter` | Session protocol: three-step start, tool-layer choice, do-not-hand-write list, three delivery gates. |
| `AGENTS.md` | Optional always-on routing table (~900 tokens) injected on the first request of every session. |

## Environment-aware routing

The static layer only knows **families** (shape, sculpt, material, deliver…), which are stable across plugin versions. The **operators** are discovered at runtime:

- `blender_env` spawns `blender -b` (a separate process — your GUI session is untouched), reads user preferences, and dumps `version + enabled addons + bpy.ops (id / description / argument names)` to `~/.dsh/dsh-blender-router/env.json`.
- `blender_route` translates the intent into English operator words (倒角→bevel, 挖孔→boolean, 展UV→unwrap) and matches them against that live snapshot.
- Common modifiers are emitted directly, e.g. `bpy.ops.object.modifier_add(type="BOOLEAN")`.

Measured on a Blender 5.2.0 install with 12 addons: 2660 operators, first scan ~2 s.

Refresh when you install an addon, upgrade Blender, or move machines: `blender_env(refresh=true)`. The three numbers it reports (version / addon count / operator count) are the signal.

## Install

```bash
dsh plugin --profile web add github:<you>/dsh-blender-router
```

Restart DSH, start a new session, then:

```
blender_env
blender_route(intent="*")
blender_coverage(days=7)
```

Optionally merge `AGENTS.md` into `~/.dsh/AGENTS.md` (global) or your project's `AGENTS.md`. It takes effect on the next session.

## Design notes

- No hard gates (a gate only proves a step ran, not that it ran well).
- No call proxying: it indexes, measures and discovers; it does not wrap the other plugin.
- Everything degrades: missing `@deepseek-ai/dsh-tools`, missing tools service, missing index, missing cache or logs only warn.

## Tests

```bash
node tests/index.test.mjs
node tests/route.test.mjs
node tests/env.test.mjs
node tests/coverage.test.mjs
```

## Limitations

Keyword + character-bigram routing, not a semantic model — hit rate depends on the `kw` lists in `data/ops-index.json` and the concept table in `src/synonyms.js`. Family index targets `dsh-blender-plugin v2.5.0`; exact op arguments always come from `catalog`. Discovery costs one Blender launch (10–60 s with many addons).

MIT licensed.
