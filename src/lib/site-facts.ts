// 站点事实单一来源（C-01 等）— 与服务端实况一致，改动只在此一处。
import { GITHUB_ORG_URL } from './site-env';
// 服务数核对（2026-10-05，五源一致）：infra-ops/docker/entrypoint-monolith.sh（27 hostname）·
// shared/ci/bin/repos.manifest（27 service-*）· sites/reference/scripts/sync-specs-zh.py（27）·
// reference.autional.cn 线上"全部 27" · demo 门户配置 27 slug。
// npm 包清单核对（2026-10-07，SDK 重命名发版后重扫：SDK 线 0.3.0 + 设计系统 rc 系列）。

export const SITE_FACTS = {
  serviceCount: 27,
  apiEndpointCount: '1,400+',
  license: 'AGPL-3.0 / MIT',
  /** GitHub 口径唯一来源：site-env.GITHUB_ORG_URL（W6：两侧同值 github.com/autional） */
  githubOrg: GITHUB_ORG_URL,
  /** 已发布至 npm 的软件包（以 npm 实查为准；发布新包后同步此表） */
  publishedPackages: [
    { name: '@autional/react', version: '0.3.0' },
    { name: '@autional/onboard', version: '0.3.0' },
    { name: '@autional/ui', version: '0.1.0-rc.42' },
    { name: '@autional/tokens', version: '0.1.0-rc.10' },
    { name: '@autional/tailwind-preset', version: '0.1.0-rc.4' },
    { name: '@autional/shared', version: '0.1.0-rc.32' },
    { name: '@autional/eslint-config', version: '0.1.0-rc.1' },
    { name: '@autional/tsconfig', version: '0.1.0-rc' },
  ],
} as const;
