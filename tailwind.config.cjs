/** @type {import('tailwindcss').Config} */
// 原先这里内联了 primary/sky/amber 三套自有色阶、success/warning/error/info、
// fontFamily、boxShadow 与 backgroundImage，与设计系统各写一份（ui 仓库 KI-010）。
// 现改用内置的权威 preset。
//
// 保留本站点自身的三项设置：darkMode（网站需要 class 切换）、
// content（含同级的 landing-site-astro 路径）、plugins（@tailwindcss/typography）。
// 注意：色阶随之收敛到权威值——原 primary-500 #2c8ec0 -> 权威 #235f84，
// 这是 DESIGN.md 已记录的决策（canonical scale beats per-site improvisation）。
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}','../landing-site-astro/src/app/**/*.{tsx,ts}'],
  presets: [require('@autional/tailwind-preset')],
  plugins: [require('@tailwindcss/typography')],
};
