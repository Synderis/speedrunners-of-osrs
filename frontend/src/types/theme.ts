export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem('theme');
  return (saved as Theme) || 'dark';
};

export const applyTheme = (theme: Theme): void => {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
};
