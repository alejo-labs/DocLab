import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from './Toaster';
import { ShortcutsModal } from './ShortcutsModal';
import { ProcessingBanner } from './ProcessingBanner';
import { GlobalDropzone } from './GlobalDropzone';
import { Onboarding } from './Onboarding';
import { CookieConsent } from './CookieConsent';

/** Layout raíz: header fijo, contenido enrutado y footer. */
export function AppShell() {
  const location = useLocation();
  const isToolPage = location.pathname.startsWith('/h/');

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      {!isToolPage && <Footer />}
      <Toaster />
      <ShortcutsModal />
      <ProcessingBanner />
      <GlobalDropzone />
      <Onboarding />
      <CookieConsent />
      <ScrollRestoration />
    </div>
  );
}
