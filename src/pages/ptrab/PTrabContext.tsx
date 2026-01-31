import React, { createContext, useContext } from 'react';
import { Tables } from '@/integrations/supabase/types';

// Define o tipo principal do PTrab
export type PTrabData = Tables<'p_trab'>;

// Define a estrutura do contexto (simplificada para agora)
interface PTrabContextType {
  ptrab: PTrabData | null;
  ptrabId: string | null;
  loading: boolean;
  refetchPTrab: () => void;
  isOwner: boolean;
  isCollaborator: boolean;
}

const PTrabContext = createContext<PTrabContextType | undefined>(undefined);

export const usePTrabContext = () => {
  const context = useContext(PTrabContext);
  if (!context) {
    throw new Error('usePTrabContext must be used within a PTrabProvider');
  }
  return context;
};

// Nota: O componente PTrabProvider real é assumido existir em outro lugar.