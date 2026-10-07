// 产品路线图单一来源 —— /roadmap 与 /about 共用（R-01：按现实重排，不做虚构完成）。
// 云托管状态口径与 /pricing、/faq 一致：当前自托管开源可用；云托管在路线图中（即将推出）。
// W10 键化：文案（period + items）一律取 i18n（roadmap.future.*，en/zh 双资源）；本文件只保留键序。

export interface RoadmapPhase {
  period: string;
  items: string[];
}

/** 未来阶段键序（2026 Q4 / 2027 H1 / 2027 H2）。 */
export const FUTURE_ROADMAP = [
  'roadmap.future.q4_2026',
  'roadmap.future.h1_2027',
  'roadmap.future.h2_2027',
] as const;
