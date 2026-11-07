import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';

type Unsaved = { hasUnsaved: boolean; setDirty(id: string, dirty: boolean): void };

const UnsavedContext = createContext<Unsaved>({ hasUnsaved: false, setDirty: () => undefined });

/** Sait si un formulaire de la page a des modifications non enregistrées, pour empêcher de publier sans elles. */
export const UnsavedProvider = ({ children }: { children: ReactNode }) => {
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(new Set());

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyForms((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hasUnsaved: dirtyForms.size > 0, setDirty }), [dirtyForms, setDirty]);
  return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>;
};

export const useHasUnsaved = (): boolean => useContext(UnsavedContext).hasUnsaved;

export const useReportDirty = (dirty: boolean): void => {
  const { setDirty } = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    setDirty(id, dirty);
    return () => setDirty(id, false);
  }, [id, dirty, setDirty]);
};
