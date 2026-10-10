export type WallpaperTheme = {
  name: string;
  gradientA: string;
  gradientB: string;
  gradientC: string;
  glowA: string;
  glowB: string;
  textPrimary: string;
  textSecondary: string;
  textQuote: string;
};

// Reusable premium gradient themes for daily wallpaper cards.
export const WALLPAPER_THEMES: WallpaperTheme[] = [
  {
    name: '晨雾紫',
    gradientA: '#f5ecff',
    gradientB: '#f8f1de',
    gradientC: '#dcecff',
    glowA: '#f5a1bd',
    glowB: '#d2bcff',
    textPrimary: '#253e64',
    textSecondary: '#4f6487',
    textQuote: '#28456f',
  },
  {
    name: '日光金',
    gradientA: '#fff4dc',
    gradientB: '#ffe8d4',
    gradientC: '#dcedff',
    glowA: '#ffbf8f',
    glowB: '#f3c7a7',
    textPrimary: '#3b3e52',
    textSecondary: '#66657e',
    textQuote: '#36455f',
  },
  {
    name: '夜蓝静谧',
    gradientA: '#e9efff',
    gradientB: '#dde7ff',
    gradientC: '#d3e4f8',
    glowA: '#b6c6ff',
    glowB: '#a4d0ea',
    textPrimary: '#2f3f67',
    textSecondary: '#5f6f92',
    textQuote: '#31486f',
  },
];
