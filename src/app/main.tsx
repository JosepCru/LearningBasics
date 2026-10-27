import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import '../ui/global.css';
import { requestPersistence } from '../data/db';
import { startSync } from '../sync/manager';
import { applyStoredTheme } from '../ui/theme';
import { App } from './App';

applyStoredTheme();
void requestPersistence();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
