"use client";

import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { WelcomeModal } from '@/components/WelcomeModal';
import { Header } from '@/components/Header';
import { PtrabList } from '@/components/PtrabList';

const PtrabPage = () => {
  const { user } = useSession();
  const [welcomeOpen, setWelcomeOpen] = React.useState(false);

  // Utiliza o hook centralizado com a lógica de atualização rápida
  const { data: configStatus, isLoading } = useOnboardingStatus();

  // Abre o modal automaticamente se não estiver pronto
  React.useEffect(() => {
    if (!isLoading && configStatus && !configStatus.isReady) {
      const hasSeenModal = localStorage.getItem(`welcome_modal_seen_${user?.id}`);
      if (!hasSeenModal) {
        setWelcomeOpen(true);
        localStorage.setItem(`welcome_modal_seen_${user?.id}`, 'true');
      }
    }
  }, [configStatus, isLoading, user?.id]);

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