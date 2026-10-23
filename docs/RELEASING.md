# 发布步骤（维护者用）

目标：把仓库推到 GitHub，并挂上 v1.1.0 的 Release 附件。

## 0. 前置

- 本机已装 Git（含 Git Credential Manager，`git config --global credential.helper` 应为 `manager`）。
- 已登录过 GitHub 的浏览器（首次 push 会弹一次网页授权，之后会记住）。

## 1. 设置提交身份

把 `<用户名>` / `<邮箱>` 换成你的 GitHub 账号（邮箱建议用 GitHub 的 noreply 地址，避免暴露真实邮箱）：

```bash
git config user.name  "<用户名>"
git config user.email "<用户名>@users.noreply.github.com"
```

已有提交是用占位身份写的，想改成你的（**推送前**执行，推送后就别改了）：

```bash
git rebase --root --exec "git commit --amend --no-edit --reset-author"
```

## 2. 建仓库

网页：GitHub → New repository → 名字 `dsh-blender-router` → Public → **不要**勾选 "Add a README"（本地已有）→ Create。

或命令行（装了 `gh` 的话）：

```bash
gh repo create dsh-blender-router --public --source . --push
```

## 3. 推送

```bash
git remote add origin https://github.com/<用户名>/dsh-blender-router.git
git push -u origin main
```

> 首次 push 会弹浏览器让你登录 GitHub 并授权 Git Credential Manager。授权一次即可。

## 4. 打 Release

```bash
git tag -a v1.1.0 -m "v1.1.0 — environment-aware routing"
git push origin v1.1.0
```

网页：Releases → Draft a new release → 选 `v1.1.0` → 标题 `v1.1.0` → 说明直接粘 `CHANGELOG.md` 的 1.1.0 段 → 附件上传：

```
dist/dsh-blender-router-1.1.0.tgz
```

生成附件（如果还没有）：

```bash
npm pack --pack-destination dist
```

## 5. 发布后自检

在另一台机器 / 干净 profile 上：

```bash
dsh plugin add github:<用户名>/dsh-blender-router
```

然后新会话里调 `blender_env`，确认三个数回来了（版本 / addon 数 / 算子数）。CI 在 `.github/workflows/ci.yml`，push 后应自动跑三平台测试。

## 收尾建议

- 仓库 About 里加一句描述：`Route DSH agents to the full Blender capability surface and the user's real addons.`
- Topics：`dsh` `blender` `ai-agent` `plugin` `bpy`
- 打 tag 前确认 `package.json` 版本与 CHANGELOG 一致（当前 1.1.0）。
