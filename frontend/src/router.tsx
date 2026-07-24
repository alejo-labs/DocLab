import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Privacy } from './pages/Privacy';
import { Cookies } from './pages/Cookies';
import { LegalNotice } from './pages/LegalNotice';
import { HowItWorks } from './pages/HowItWorks';
import { Security } from './pages/Security';
import { About } from './pages/About';
import { ToolPage } from './pages/ToolPage';
import { NotFound } from './pages/NotFound';
import { RouteError } from './pages/RouteError';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'como-funciona', element: <HowItWorks /> },
      { path: 'seguridad', element: <Security /> },
      { path: 'sobre', element: <About /> },
      { path: 'privacidad', element: <Privacy /> },
      { path: 'cookies', element: <Cookies /> },
      { path: 'aviso-legal', element: <LegalNotice /> },
      { path: 'h/:slug', element: <ToolPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
