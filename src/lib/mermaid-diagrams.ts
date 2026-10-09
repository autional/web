/**
 * 博客 mermaid 图表运行时：客户端懒加载渲染（文章写 ```mermaid 栅栏即可）。
 *
 * 构建期 shiki 按 mermaid 语法高亮源码（产物保留 data-language="mermaid"，见 [slug].astro 脚本），
 * 本模块在浏览器里把源码块替换为 SVG。无图页面零开销：查不到块就不加载 mermaid。
 * 主题以 html.dark 为同一事实源（ThemeToggle 切的就是它），切换时重绘。
 * 失败不崩页：单块降级回源码显示（三态见 src/styles/blog-diagrams.css）。
 * 作者注意：sequence 图 Note 文本避免半角「;」和第二个半角「:」——mermaid 视作语句
 * 分隔符，会解析失败（实测）；zh 全角「；」「：」安全，或改用破折号。
 */

type MermaidApi = typeof import('mermaid')['default'];

const SELECTOR = '.prose pre[data-language="mermaid"]';

interface Block {
  figure: HTMLElement;
  canvas: HTMLElement;
  source: string;
}

/** 两套配色取自站点 tokens（@autional/tokens）：浅色主色 primary / sky 族，深色用 primary-900 底 + sky 亮线。 */
function themeVars(dark: boolean): Record<string, string> {
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const fontFamily = bodyFont && bodyFont !== '' ? bodyFont : 'Inter, sans-serif';
  const base = {
    fontFamily,
    fontSize: '15px',
    edgeLabelBackground: dark ? '#041d31' : '#fafbfc',
    clusterBkg: dark ? '#0f3348' : '#f7fafd',
    clusterBorder: dark ? '#429bc5' : '#a3c7e3',
    textColor: dark ? '#f8fbfe' : '#041d31',
    titleColor: dark ? '#f8fbfe' : '#041d31',
    signalColor: dark ? '#87ceeb' : '#235f84',
    signalTextColor: dark ? '#f8fbfe' : '#041d31',
    actorBkg: dark ? '#0a2940' : '#eef9fd',
    actorBorder: dark ? '#429bc5' : '#a3c7e3',
    actorTextColor: dark ? '#f8fbfe' : '#041d31',
    activationBkgColor: dark ? '#0f3348' : '#f7fafd',
    activationBorderColor: dark ? '#429bc5' : '#a3c7e3',
    labelBoxBkgColor: dark ? '#0f3348' : '#f7fafd',
    labelBoxBorderColor: dark ? '#429bc5' : '#a3c7e3',
    labelTextColor: dark ? '#f8fbfe' : '#041d31',
    loopTextColor: dark ? '#f8fbfe' : '#041d31',
    noteBkgColor: dark ? '#0f3348' : '#f7fafd',
    noteBorderColor: dark ? '#429bc5' : '#a3c7e3',
    noteTextColor: dark ? '#f8fbfe' : '#041d31',
  };
  return dark
    ? {
        ...base,
        background: '#041d31',
        primaryColor: '#0a2940',
        primaryBorderColor: '#429bc5',
        primaryTextColor: '#f8fbfe',
        lineColor: '#87ceeb',
        secondaryColor: '#0f3348',
        tertiaryColor: '#0a1f30',
      }
    : {
        ...base,
        background: '#fafbfc',
        primaryColor: '#eef9fd',
        primaryBorderColor: '#a3c7e3',
        primaryTextColor: '#041d31',
        lineColor: '#235f84',
        secondaryColor: '#f7fafd',
        tertiaryColor: '#ffffff',
      };
}

// 渲染 id 前缀：渲染沙箱（body 下 id = "d" + 前缀）的兜底样式按此前缀匹配，见 blog-diagrams.css
const RENDER_ID_PREFIX = 'aum-';

export async function initMermaidDiagrams(): Promise<void> {
  const pres = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  if (pres.length === 0) return;

  const blocks: Block[] = pres.map((pre) => {
    const source = (pre.textContent ?? '').replace(/\r\n?/g, '\n').trim();
    const next = pre.nextElementSibling;
    const figure = document.createElement('figure');
    figure.className = 'mermaid-block';
    figure.dataset.mermaidState = 'pending';
    const canvas = document.createElement('div');
    canvas.className = 'mermaid-canvas';
    canvas.style.minHeight = `${pre.offsetHeight}px`; // 预留高度防布局塌陷
    pre.replaceWith(figure);
    figure.append(pre, canvas);
    // 图题吸收：块后紧跟的「整行斜体段落」收进 figcaption（作者约定 *图 1：…*）
    if (
      next instanceof HTMLParagraphElement &&
      next.childElementCount === 1 &&
      next.firstElementChild?.tagName === 'EM' &&
      (next.textContent ?? '').trim() === (next.firstElementChild.textContent ?? '').trim()
    ) {
      const caption = document.createElement('figcaption');
      caption.innerHTML = next.firstElementChild.innerHTML;
      figure.append(caption);
      next.remove();
    }
    return { figure, canvas, source };
  });

  const root = document.documentElement;
  root.classList.add('js-mermaid'); // CSS 门：脚本确认接管后才隐藏源码（无 JS 访客见源码）

  let mermaidApi: MermaidApi;
  try {
    mermaidApi = (await import('mermaid')).default;
  } catch (err) {
    root.classList.remove('js-mermaid'); // 恢复源码可见
    console.warn('[blog] mermaid 加载失败，保留源码显示', err);
    return;
  }

  const fontsReady = Promise.race([
    document.fonts.ready,
    new Promise<void>((resolve) => setTimeout(resolve, 1000)),
  ]);

  let seq = 0;
  let dark = root.classList.contains('dark');
  let running = false;
  let rerun = false;

  async function renderAll(): Promise<void> {
    if (running) {
      rerun = true; // 重绘期间主题再变 → 打标，本轮结束后补一轮
      return;
    }
    running = true;
    try {
      await fontsReady;
      do {
        rerun = false;
        dark = root.classList.contains('dark');
        mermaidApi.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: 'base',
          // 自然尺寸渲染；超宽图由 blog-diagrams.css 的 max-width:100% 等比缩到容器宽
          flowchart: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
          state: { useMaxWidth: false },
          themeVariables: themeVars(dark),
        });
        for (const block of blocks) {
          try {
            const { svg } = await mermaidApi.render(`${RENDER_ID_PREFIX}${++seq}`, block.source);
            block.canvas.innerHTML = svg;
            block.figure.dataset.mermaidState = 'ready';
            block.canvas.style.minHeight = '';
          } catch (err) {
            block.figure.dataset.mermaidState = 'error';
            console.warn('[blog] mermaid 渲染失败，保留源码显示', err);
          }
        }
      } while (rerun);
    } finally {
      running = false;
    }
  }

  new MutationObserver(() => {
    if (root.classList.contains('dark') !== dark) void renderAll();
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  await renderAll();
}
