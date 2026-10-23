# dsh-blender-router

> Make a DSH agent actually use the whole Blender capability surface (28 families / 186 ops) instead of stopping at `primitive_cube_add`.

Works alongside [`dsh-blender-plugin`](https://github.com/sixtysevenlf/dsh-blender-plugin).

## Why

The 186 ops live behind `blender_rt_plan(op="catalog")`, an ~11 KB dump a model rarely reads. The bundled skill is ~125 KB (~27k tokens) and is usually skipped. The default path collapses to `blender_rt_do` + `primitive_cube_add` — roughly 1 op out of 186.

## What it adds

| Surface | Purpose |
|---|---|
| `blender_route(intent, k)` | Intent → matching capability families, entry chain, pitfalls, full op list. One cheap call instead of a catalog dump. |
| `blender_coverage(days, dir, top)` | Reads the plugin's own `trajectory/*.jsonl` and reports real usage: families used / 28, top ops, unused families, plan share. |
| bundled skill `blender-toolrouter` | Session protocol: three-step start, tool-layer choice, do-not-hand-write list, three delivery gates. |
| `AGENTS.md` | Optional always-on routing table (~900 tokens) injected on the first request of every session. |

## Install

```bash
dsh plugin --profile web add github:<you>/dsh-blender-router
```

Restart DSH, start a new session, then:

```
blender_route(intent="*")
blender_coverage(days=7)
```

Optionally merge `AGENTS.md` into `~/.dsh/AGENTS.md` (global) or your project's `AGENTS.md`. It takes effect on the next session.

## Design notes

- No hard gates (a gate only proves a step ran, not that it ran well).
- No call proxying: it indexes and measures, it does not wrap the other plugin.
- Everything degrades: missing `@deepseek-ai/dsh-tools`, missing tools service, missing index or logs only warn.

## Tests

```bash
node tests/index.test.mjs
node tests/route.test.mjs
node tests/coverage.test.mjs
```

## Limitations

Keyword + character-bigram routing, not a semantic model — hit rate depends on the `kw` lists in `data/ops-index.json`. Index targets `dsh-blender-plugin v2.5.0`; exact op arguments always come from `catalog`.

MIT licensed.
