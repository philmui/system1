import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const storageKey = 'discovery-studio-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1018' : '#f5f7fa');
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // The toggle still works when browser storage is unavailable.
    }
  }, [theme]);

  return { theme, setTheme };
}
