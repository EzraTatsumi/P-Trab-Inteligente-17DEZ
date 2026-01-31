import React, { createContext, useContext } from 'react';
import { Tables } from '@/integrations/supabase/types';

// Define the core PTrab type
export type PTrabData = Tables<'p_trab'>;

// Define the context structure (simplified for now)
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

// Note: The actual PTrabProvider component implementation is assumed to exist elsewhere 
// or will be created when needed, but defining the context resolves the import error.