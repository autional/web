#!/usr/bin/env node
/**
 * check-i18n.mjs —— 双语资源门（plan §6-B1 行 6，prebuild 前置；非零退出 = 阻断构建）。
 *
 * 断言：
 *   G1 单键空间：两文件均为嵌套结构；键名本身不得含 '.'（i18next 默认 keySeparator='.'，
 *      扁平点号键会与嵌套路径混淆、且不可达）；
 *   G2 键集对称：en-US.json 与 zh-CN.json 的展开键集完全一致；
 *   G3 无空值：字符串非空（trim 后）；数组非空；数组/对象元素递归非空、类型合法；
 *   G4 形状对称：数组/对象值的结构签名（元素类型链 + 对象键集）两侧一致。
 */
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`../src/i18n/${name}`, import.meta.url), 'utf8'));

const issues = [];
const flatten = (obj, prefix, side) => {
  const out = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (k.includes('.')) issues.push(`[G1] ${side}: 键名含点号（禁扁平键）：${path}`);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [kk, vv] of flatten(v, path, side)) out.set(kk, vv);
    } else {
      out.set(path, v);
    }
  }
  return out;
};

const en = flatten(load('en-US.json'), '', 'en-US');
const zh = flatten(load('zh-CN.json'), '', 'zh-CN');

// G2 键集对称
for (const k of en.keys()) if (!zh.has(k)) issues.push(`[G2] zh-CN 缺键：${k}`);
for (const k of zh.keys()) if (!en.has(k)) issues.push(`[G2] en-US 缺键：${k}`);

// G3 无空值（递归覆盖数组/对象元素）
const checkValue = (side, k, v) => {
  if (typeof v === 'string') {
    if (v.trim() === '') issues.push(`[G3] ${side}: 空值：${k}`);
    return;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) issues.push(`[G3] ${side}: 空数组：${k}`);
    v.forEach((item, i) => checkValue(side, `${k}[${i}]`, item));
    return;
  }
  if (v !== null && typeof v === 'object') {
    for (const [kk, vv] of Object.entries(v)) checkValue(side, `${k}.${kk}`, vv);
    return;
  }
  issues.push(`[G3] ${side}: 非法值类型（${v === null ? 'null' : typeof v}）：${k}`);
};
for (const [side, map] of [['en-US', en], ['zh-CN', zh]]) {
  for (const [k, v] of map) checkValue(side, k, v);
}

// G4 形状对称（数组/对象值的结构签名两侧一致）
const shape = (v) => {
  if (Array.isArray(v)) return `[${v.map(shape).join(',')}]`;
  if (v !== null && typeof v === 'object') return `{${Object.keys(v).sort().join(',')}}`;
  return typeof v;
};
for (const [k, v] of en) {
  if (v !== null && typeof v === 'object') {
    const sigEn = shape(v);
    const sigZh = shape(zh.get(k));
    if (sigEn !== sigZh) issues.push(`[G4] 形状不对称：${k}（en=${sigEn} / zh=${sigZh}）`);
  }
}

console.log(`[check-i18n] en-US=${en.size} keys · zh-CN=${zh.size} keys · 对称=${issues.length === 0 ? '✔' : '✘'}`);
if (issues.length) {
  for (const line of issues.slice(0, 40)) console.error('  ' + line);
  if (issues.length > 40) console.error(`  … 其余 ${issues.length - 40} 条省略`);
  console.error(`[check-i18n] FAIL —— ${issues.length} 项问题`);
  process.exit(1);
}
console.log('[check-i18n] PASS');
