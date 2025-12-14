import React, { createContext, useContext, useState } from 'react';

interface PTrabContextType {
  // Define context state/functions here if needed later
  currentPTrabId: string | null;
  setPTrabId: (id: string | null) => void;
}

const PTrabContext = createContext<PTrabContextType | undefined>(undefined);

export function PTrabProvider({ children }: { children: React.ReactNode }) {
  const [currentPTrabId, setCurrentPTrabId] = useState<string | null>('some-uuid'); // Default for testing

  const setPTrabId = (id: string | null) => {
    setCurrentPTrabId(id);
  };

  return (
    <PTrabContext.Provider value={{ currentPTrabId, setPTrabId }}>
      {children}
    </PTrabContext.Provider>
  );
}

export function usePTrabContext() {
  const context = useContext(PTrabContext);
  if (context === undefined) {
    throw new Error('usePTrabContext must be used within a PTrabProvider');
  }
  return context;
}