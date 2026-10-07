# Autional Website (web)

**Stack**: Astro 5 SSG + React 19 + Tailwind 3.4
**Regions**: `www.autional.cn`（zh）/ `www.autional.com`（en）——**同一份源代码、两个 Vercel 项目**，差异全部由构建期区域环境注入（B1 单源双区）。

## Region env (build-time)

Vercel 项目侧注入，`astro.config.mjs` 经 `vite.define` 内联为 `PUBLIC_*`（读取单点：`src/lib/site-env.ts`；落点表见 `docs/positioning/22-b1-execution-card.md` §4.1）：

| Var | cn 项目 | com 项目 |
| --- | --- | --- |
| `REGION` | `cn` | `com` |
| `SITE_URL` | `https://www.autional.cn` | `https://www.autional.com` |
| `DEFAULT_LANG` | `zh` | `en` |
| `FALLBACK_LANG` | `zh` | `en` |
| `CDN_HOST` | `https://cdn.autional.cn` | `https://cdn.autional.com` |

本地 dev 无 env 时兜底 cn 值。站点域名 / CDN / 兄弟站 / GitHub 口径一律从 `src/lib/site-env.ts` 派生，禁止在页面里散落区域字面量。

## Development

```bash
pnpm install
pnpm dev      # http://localhost:13118
pnpm build    # 构建前跑 gen-static + check-i18n，产物在 dist/
pnpm typecheck
```

## i18n

- `src/i18n/en-US.json` / `zh-CN.json`：**对称单键空间**（嵌套键；数组长度 / 对象键集一致），页面文案全部键化；
- 语言中立的结构数据（图标、日期、端口、路径等）留在页面代码里；
- 守卫脚本：`node scripts/check-i18n.mjs`（G1 嵌套键 / G2 键集对称 / G3 递归非空 / G4 形状对称）；
- 各页面渲染语言 = 本区 `DEFAULT_LANG`；顶栏/页脚 chrome 支持就地语言切换（同一份资源）。

## Deploy

Push 后由 Vercel 构建（cn / com 两项目共用本仓，靠上表 env 区分）；构建期生成物（`robots.txt` / `llms.txt` / `ai/skill.md` / og 图）由 `scripts/gen-static.mjs` 按本区 env 落进 `public/`，不入库。
