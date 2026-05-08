import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'flux_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.loadTheme());

  readonly theme    = this._theme.asReadonly();
  readonly isDark   = () => this._theme() === 'dark';
  readonly isLight  = () => this._theme() === 'light';

  constructor() {
    // Aplicar clase al <html> cada vez que cambia el tema
    effect(() => {
      const t = this._theme();
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem(STORAGE_KEY, t);
    });
  }

  toggle() {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme) {
    this._theme.set(theme);
  }

  private loadTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;

    // Respetar preferencia del sistema si no hay preferencia guardada
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
