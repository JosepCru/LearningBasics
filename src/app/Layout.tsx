import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { manifest } from '../features/content/content';
import { useTheme, type ThemeChoice } from '../ui/theme';
import styles from './Layout.module.css';

const THEME_LABELS: Record<ThemeChoice, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };

export function Layout() {
  const [theme, setTheme] = useTheme();
  const { pathname } = useLocation();

  // Al cambiar de página, empezar arriba y llevar el foco al contenido (lectores de pantalla).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip} onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          LearningBasics
        </NavLink>
        <nav aria-label="Principal" className={styles.nav}>
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {manifest.subjects.map((s) => (
            <NavLink key={s.id} to={`/subjects/${s.id}`}>
              {s.title}
            </NavLink>
          ))}
        </nav>
        <label className={styles.theme}>
          <span className="visually-hidden">Tema</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeChoice)}>
            {(Object.keys(THEME_LABELS) as ThemeChoice[]).map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
