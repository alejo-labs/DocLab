import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from './Toaster';
import { ShortcutsModal } from './ShortcutsModal';
import { ProcessingBanner } from './ProcessingBanner';
import { GlobalDropzone } from './GlobalDropzone';
import { Onboarding } from './Onboarding';

/** Layout raíz: header fijo, contenido enrutado y footer. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      <ShortcutsModal />
      <ProcessingBanner />
      <GlobalDropzone />
      <Onboarding />
    </div>
  );
}
