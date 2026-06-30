# Aotional Website

Static website for [Aotional](https://www.aotional.com) — Enterprise Identity & Access Management.

Built with [Astro](https://astro.build) SSG, deployed on [Vercel](https://vercel.com).

## Project Docs

- 详细变更说明：`docs/2026-06-30-website-brand-refresh.md`
- UI / 品牌落地规范：`docs/website-ui-brand-guidelines.md`
- Vercel 部署故障记录：`docs/vercel-deployment-notes.md`

## Development

```bash
pnpm install
pnpm dev        # http://localhost:13118
pnpm build      # Static output to dist/
```

## Deploy

Push to `main` — Vercel auto-deploys.

## Notes

- 当前仓库仍存在部分历史 `astro check` 错误，见详细变更说明中的技术债章节。
- 若本地 `pnpm` 因 ignored build scripts 阻塞构建，请参考 `docs/vercel-deployment-notes.md` 中的说明。
