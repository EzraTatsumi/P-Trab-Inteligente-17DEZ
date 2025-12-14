"use client";

import { createContext, useContext } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';

// Define the context type
interface SupabaseContextType {
  supabase: SupabaseClient<any, 'public', any>;
}

// Create the context
const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// Provider component
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook to use the Supabase client
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}