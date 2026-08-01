import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router'
import { applyTheme, initialTheme } from './lib/useTheme'

// Aplica el tema antes del primer render para evitar parpadeo.
applyTheme(initialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
