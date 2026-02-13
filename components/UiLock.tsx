import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type UiLockContextValue = {
  isLocked: boolean;
  runWithLock: <T>(fn: () => Promise<T>) => Promise<T>;
};

const UiLockContext = createContext<UiLockContextValue | null>(null);

export const UiLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lockCount, setLockCount] = useState(0);

  const runWithLock = useCallback(async <T,>(fn: () => Promise<T>) => {
    setLockCount(count => count + 1);
    try {
      return await fn();
    } finally {
      setLockCount(count => Math.max(0, count - 1));
    }
  }, []);

  const value = useMemo(
    () => ({
      isLocked: lockCount > 0,
      runWithLock
    }),
    [lockCount, runWithLock]
  );

  return <UiLockContext.Provider value={value}>{children}</UiLockContext.Provider>;
};

export const useUiLock = (): UiLockContextValue => {
  const context = useContext(UiLockContext);
  if (!context) {
    throw new Error('useUiLock must be used within UiLockProvider');
  }
  return context;
};

export const UiLockOverlay: React.FC = () => {
  const { isLocked } = useUiLock();

  if (!isLocked) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center"
      role="alert"
      aria-busy="true"
      aria-live="assertive"
    >
      <div className="bg-white rounded-2xl shadow-2xl px-6 py-5 flex items-center space-x-3">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-700">Working... Please wait.</p>
      </div>
    </div>
  );
};
