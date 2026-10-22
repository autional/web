# Vercel 部署故障记录

> 记录日期: 2026-06-30
> 项目: autional/web (www.autional.com) + autional/docs (docs.autional.com)

---

## www 构建故障

### F1: pnpm frozen-lockfile — pnpm-lock.yaml 缺失

**时间**: 17:52
**症状**:
```
ERR_PNPM_NO_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
```
**根因**: `docs-site/` 和 `dev-site/` 子目录的 `package.json` 被 pnpm 工作区检测为工作区成员。
工作区需要 lockfile 涵盖所有成员，但子目录没有独立的 lockfile。
**修复**: 
1. `.gitignore` 添加 `docs-site/` `dev-site/`
2. `git rm --cached` 从追踪中删除
3. 子目录移到独立仓库 `autional/docs`
**状态**: ✅ 已修复

### F2: docs-site 文件残留

**时间**: 17:57
**症状**: 同上错误（`.gitignore` 改完后 Vercel 还在用旧 commit）
**根因**: 修改 `.gitignore` 后忘记 `git rm --cached` 删除已追踪的文件。
**修复**: 执行 `git rm -r docs-site dev-site` + commit push。
**状态**: ✅ 已修复

### F3: /cases 空列表 + 详情页 404（Astro 7 旧式集合静默失效）

**时间**: 2026-10-22（`6aa144a` 升级当天暴露，`1bd91bc` 修复）
**症状**:

- `https://www.autional.cn/cases` 列表 0 张卡；
- `/cases/nextchat/`、`/cases/novel/` 返回 404；
- sitemap 与站内搜索索引没有案例条目；
- `.cn` 与 `.com` 同源同坏。

**根因**: Astro 5→7 升级只把 `blog` 迁到 `glob()` loader，`cases` 仍是旧式 `type: 'content'`。Astro 7 在 `legacy.collectionsBackwardsCompat=false`（默认）时直接跳过旧式集合（`astro/dist/content/content-layer.js`），`getCollection('cases')` 返回空数组。

**为什么没被发现**: 构建退出码 0，只有 WARN：

```
[WARN] [content] The collection "cases" does not exist or is empty.
```

页数 74（正确值 76）。页面照建，只是空。

**修复**:

1. `src/content.config.ts`：`cases` 改 `glob({ pattern: '**/*.md', base: './src/content/cases' })`；
2. `src/pages/cases/[slug].astro`：`entry.render()` → `render(entry)`。

**验证**: CN / COM 各 76 页；`[WARN] [content]` 0 条；两区 `/cases` 各 2 张卡；两个详情页正文与速览表格正常；sitemap 含两条案例 URL。

**预防**:

| 措施 | 做法 |
|---|---|
| 升级后查告警 | 构建日志搜 `[WARN] [content]`，必须 0 条 |
| 升级后查页数 | 与升级前比对；`/cases`、`/blog` 各详情页逐条可达 |
| 新集合写法 | 一律 `glob()` loader；禁止 `type: 'content'` |

---

## docs 构建故障

### D1: Next.js WARNING（非阻塞）

**时间**: 18:07-18:14
**症状**:
```
WARNING! When using Next.js, it is recommended to place JavaScript Functions inside of the `pages/api`
```
**根因**: Vercel 检测到 `pages/` 目录（Astro 的 `src/pages/`），误判为 Next.js 项目。
Vercel 的自动框架检测有歧义——Astro 和 Next.js 都使用 `pages/` 命名。
**影响**: 无。Astro 构建完全正常，仅日志噪音。
**修复**: 无需修复。Vercel 已知问题。

### D2: esbuild 构建脚本被忽略

**时间**: 所有构建
**症状**:
```
Ignored build scripts: esbuild@0.25.12, esbuild@0.27.7, sharp@0.34.5
```
**根因**: pnpm v10+ 默认锁定构建脚本。esbuild 的 postinstall 脚本不会执行，
但 Vercel 构建环境已预装 esbuild 二进制。
**影响**: 无。Astro 构建在 Vercel 上正常。
**修复**: 如需本地构建，在 `.npmrc` 添加 `onlyBuiltDependencies=esbuild sharp`。

---

## 待解决

### P1: docs.autional.com 域名绑定

**问题**: `autional/docs` 构建成功但 `https://docs.autional.com/` 返回 000。
**原因**: Vercel 项目尚未配置自定义域名。
**解决**: 用户需在 Vercel → docs project → Settings → Domains 添加。
DNS: CNAME `docs` → `cname.vercel-dns.com`。

### P2: www.autional.com 初始构建冻结

**问题**: 首次构建后 `pnpm-lock.yaml` 缺失导致 frozen-lockfile 失败。
**解决**: 删除子目录后恢复。
**预防**: 新建 Vercel 项目时用 `--no-frozen-lockfile` 首次构建。
