import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { ToastProvider } from './context/ToastContext';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/auth.css';
import './styles/catalog.css';
import './styles/work.css';
import './styles/forms.css';
import './styles/project.css';
import './styles/board.css';
import './styles/admin.css';

// Nella demo statica (GitHub Pages) gli indirizzi usano il # perché non c'è un server che risponda a ogni percorso.
const DEMO = import.meta.env.MODE === 'demo';
const Router = DEMO ? HashRouter : BrowserRouter;
const DemoLayer = DEMO ? lazy(() => import('./demo/DemoLayer')) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <ToastProvider>
        <AuthProvider>
          <RealtimeProvider>
            <ConfirmProvider>
              <App />
              {DemoLayer && (
                <Suspense fallback={null}>
                  <DemoLayer />
                </Suspense>
              )}
            </ConfirmProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  </StrictMode>
);
