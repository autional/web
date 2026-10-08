# scripts/fonts —— 分享卡渲染字体

resvg 渲染 og 分享卡时**不加载系统字体**（构建机字体不可控）。上线以来 og-default.png
一直是空图正是这个原因：`loadSystemFonts: false` 而没给 `fontFiles`，所有 `<text>` 渲染为空。
字体因此随仓携带：

| 文件 | 用途 | 来源 |
|------|------|------|
| Inter-Regular.ttf / Inter-ExtraBold.ttf | 拉丁 400/800（品牌名、标题） | Inter 4.1 静态实例（rsms/inter releases） |
| NotoSansSC-Regular.subset.ttf / NotoSansSC-Bold.subset.ttf | 中文回退 400/700 | google/fonts NotoSansSC 静态实例，按站内语料子集化 |
| subset-corpus.txt | 子集化语料（1775 字符） | `node scripts/fonts/build-corpus.mjs` 生成 |
| LICENSE-Inter-OFL.txt / LICENSE-NotoSansSC-OFL.txt | OFL 1.1 | 同源 |

## 为什么子集化

全量 Noto Sans SC 静态字重 = 10.6MB/份（Web 仓总 pack 才 ~3MB）。语料 = 两区博客全文
（含 frontmatter）+ 双语 i18n 资源 + ASCII + 中英文标点，子集后 ~525KB/份。

## 何时重建

新增博客/文案引入了语料外的字符时（分享卡该字渲染为空；构建期覆盖检查会点名）：

```bash
node scripts/fonts/build-corpus.mjs        # 1. 从当前站内文本重建语料
# 2. 从**原始母版**重新子集（不能在已有子集文件上二次子集——先前丢掉的字形找不回）：
python -m fontTools.subset <母版>.ttf \
  --text-file=scripts/fonts/subset-corpus.txt \
  --layout-features='*' --name-IDs='*' --name-legacy --name-languages='*' \
  --no-hinting --glyph-names --output-file=scripts/fonts/NotoSansSC-Regular.subset.ttf
# Bold 同法换母版与输出名
```

环境：python + `pip install fonttools brotli`。母版（NotoSansSC 静态 400/700）不在仓内，
从 google/fonts `ofl/notosanssc` 取 VF 后实例化：

```bash
python -m fontTools.varLib.instancer "NotoSansSC[wght].ttf" wght=400 --update-name-table
```

**VF 陷阱**：google/fonts 的 NotoSansSC VF 默认实例是 Thin（family 名 "Noto Sans SC Thin"、
OS/2 weight=100）——不实例化就加载会让整个字体栈的字重选择失效（Inter 的 800 被静默降级成
Regular）。实例化（含 `--update-name-table`）后家族名/字重元数据才正常。

## 渲染注意事项

- resvg 忽略 **woff2**（只认 TTF/OTF）；可变字体只渲默认实例（字重轴不生效）→ 必须静态 TTF。
- 模板 font-family 写 `Inter, 'Noto Sans SC', sans-serif`；gen-static 传
  `defaultFontFamily: 'Inter'`，CJK 逐字回退到 Noto。
- emoji（✅❌⭐…）不在语料内：Noto Sans SC 无这些字形，浏览器侧由系统彩色 emoji 字体渲染，
  分享卡不涉及——build-corpus 已排除 emoji 区段。
