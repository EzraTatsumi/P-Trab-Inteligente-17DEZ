import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// Define os tipos básicos para o PTrab
export type PTrab = Tables<'p_trab'>;

// Define o tipo para o contexto
interface PTrabContextType {
  ptrabId: string | null;
  ptrabData: PTrab | null;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setGlobalError: (message: string) => void;
  updatePTrabData: (data: Partial<PTrab>) => void;
  // Adicione outras funções ou estados necessários para o fluxo de trabalho do PTrab
}

const PTrabContext = createContext<PTrabContextType | undefined>(undefined);

export const PTrabProvider = ({ children }: { children: ReactNode }) => {
  const [ptrabId, setPTrabId] = useState<string | null>(null);
  const [ptrabData, setPTrabData] = useState<PTrab | null>(null);
  const [loading, setLoading] = useState(false);

  const setGlobalError = useCallback((message: string) => {
    toast.error(message);
  }, []);
  
  const updatePTrabData = useCallback((data: Partial<PTrab>) => {
    setPTrabData(prev => {
      if (!prev) return null;
      return { ...prev, ...data };
    });
  }, []);

  // Simulação de carregamento inicial (será implementado no PTrabForm principal)
  // Por enquanto, apenas inicializa com um ID de teste se necessário
  // useEffect(() => {
  //   const id = new URLSearchParams(window.location.search).get('ptrabId');
  //   if (id) {
  //     setPTrabId(id);
  //     // Simular fetch de dados aqui
  //   }
  // }, []);

  const value = {
    ptrabId,
    ptrabData,
    loading,
    setLoading,
    setGlobalError,
    updatePTrabData,
  };

  return <PTrabContext.Provider value={value}>{children}</PTrabContext.Provider>;
};

export const usePTrabContext = () => {
  const context = useContext(PTrabContext);
  if (context === undefined) {
    throw new Error('usePTrabContext must be used within a PTrabProvider');
  }
  return context;
};