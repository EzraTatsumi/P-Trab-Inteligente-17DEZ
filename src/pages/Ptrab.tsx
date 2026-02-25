"use client";

import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCompletedMissions } from '@/lib/missionUtils';
import { WelcomeModal } from '@/components/WelcomeModal';
import { Header } from '@/components/Header';
import { PtrabList } from '@/components/PtrabList';

const PtrabPage = () => {
  const { user } = useSession();
  const [welcomeOpen, setWelcomeOpen] = React.useState(false);

  // Busca dados de configuração para o status do modal
  const { data: configStatus } = useQuery({
    queryKey: ['activation-status', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      const { count: omCount } = await supabase
        .from('organizacoes_militares')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const { data: logistica } = await supabase
        .from('diretrizes_custeio')
        .select('ano_referencia')
        .eq('user_id', user?.id)
        .limit(1);

      const { data: operacional } = await supabase
        .from('diretrizes_operacionais')
        .select('ano_referencia')
        .eq('user_id', user?.id)
        .limit(1);

      // LÓGICA DE MISSÕES: Só conta como "Concluído" se as 6 estiverem prontas
      const completedCount = getCompletedMissions(user?.id).length;
      const hasMissions = completedCount >= 6;

      const hasOMs = (omCount || 0) > 0;
      const hasLogistica = (logistica?.length || 0) > 0;
      const hasOperacional = (operacional?.length || 0) > 0;

      return {
        hasMissions,
        hasOMs,
        hasLogistica,
        hasOperacional,
        logYear: profile?.default_logistica_year || logistica?.[0]?.ano_referencia,
        opYear: profile?.default_operacional_year || operacional?.[0]?.ano_referencia,
        isReady: hasMissions && hasOMs && hasLogistica && hasOperacional
      };
    },
    enabled: !!user?.id
  });

  // Abre o modal automaticamente se não estiver pronto
  React.useEffect(() => {
    if (configStatus && !configStatus.isReady) {
      const hasSeenModal = localStorage.getItem(`welcome_modal_seen_${user?.id}`);
      if (!hasSeenModal) {
        setWelcomeOpen(true);
        localStorage.setItem(`welcome_modal_seen_${user?.id}`, 'true');
      }
    }
  }, [configStatus, user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Meus Planos de Trabalho</h1>
        </div>
        
        <PtrabList />

        <WelcomeModal 
          open={welcomeOpen} 
          onOpenChange={setWelcomeOpen} 
          status={configStatus || null} 
        />
      </main>
    </div>
  );
};

export default PtrabPage;