import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Tables } from '@/integrations/supabase/types';

// Tipo simplificado para o PTrab
export type PTrabData = Tables<'p_trab'>;

interface PTrabContextType {
  currentPTrab: PTrabData | null;
  setCurrentPTrab: (ptrab: PTrabData | null) => void;
}

const PTrabContext = createContext<PTrabContextType | undefined>(undefined);

export const PTrabProvider = ({ children }: { children: ReactNode }) => {
  const [currentPTrab, setCurrentPTrab] = useState<PTrabData | null>(null);

  return (
    <PTrabContext.Provider value={{ currentPTrab, setCurrentPTrab }}>
      {children}
    </PTrabContext.Provider>
  );
};

export const usePTrabContext = () => {
  const context = useContext(PTrabContext);
  if (context === undefined) {
    throw new Error('usePTrabContext must be used within a PTrabProvider');
  }
  return context;
};