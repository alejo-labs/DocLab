import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Privacy } from './pages/Privacy';
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
      { path: 'privacidad', element: <Privacy /> },
      { path: 'h/:slug', element: <ToolPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
