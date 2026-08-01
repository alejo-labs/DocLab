import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

interface ActiveDocContextType {
  hasActiveDoc: boolean;
  setHasActiveDoc: (active: boolean) => void;
}

export const ActiveDocContext = createContext<ActiveDocContextType>({
  hasActiveDoc: false,
  setHasActiveDoc: () => {},
});

export const useActiveDoc = () => useContext(ActiveDocContext);

export function ActiveDocProvider({ children }: { children: ReactNode }) {
  const [hasActiveDoc, setHasActiveDoc] = useState(false);
  return createElement(
    ActiveDocContext.Provider,
    { value: { hasActiveDoc, setHasActiveDoc } },
    children,
  );
}

/**
 * Hook para informar a la página receptora (ToolPage) de que hay un documento
 * activo cargado en el motor de la herramienta.
 */
export function useReportActiveDoc(active: boolean) {
  const { setHasActiveDoc } = useActiveDoc();
  useEffect(() => {
    setHasActiveDoc(active);
    return () => setHasActiveDoc(false);
  }, [active, setHasActiveDoc]);
}
