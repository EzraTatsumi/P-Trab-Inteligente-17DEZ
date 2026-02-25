"use client";

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { PtrabTable } from "@/components/PtrabTable";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Filter, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import InstructionHub from "@/components/InstructionHub";
import GhostModeBanner from "@/components/GhostModeBanner";
import { runMission01 } from "@/tours/missionTours";
import { isGhostMode } from "@/lib/ghostStore";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const { status, isLoading } = useSystemStatus();
  const [showWelcome, setShowWelcome] = useState(false);
  const [completedMissions, setCompletedMissions] = useState<number[]>([]);

  useEffect(() => {
    if (!isLoading && status && !status.isReady) {
      setShowWelcome(true);
    }
  }, [isLoading, status]);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`completed_missions_${user.id}`);
      if (saved) setCompletedMissions(JSON.parse(saved));
    }
    
    // Abrir o hub se solicitado via URL
    if (searchParams.get('showHub') === 'true') {
      window.dispatchEvent(new CustomEvent('instruction-hub:open'));
    }
  }, [user?.id, searchParams]);

  const missions = [
    {
      id: 1,
      title: "Seu Primeiro P Trab",
      description: "Aprenda a criar um Plano de Trabalho simulado e entenda o fluxo básico.",
      onStart: () => {
        if (user?.id) {
          runMission01(user.id, () => {
            // Callback ao finalizar a missão
            const newCompleted = [...new Set([...completedMissions, 1])];
            setCompletedMissions(newCompleted);
            localStorage.setItem(`completed_missions_${user.id}`, JSON.stringify(newCompleted));
            
            // Reabre o Centro de Instrução para mostrar a progressão
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('instruction-hub:open'));
            }, 500);
          });
        }
      }
    },
    {
      id: 2,
      title: "Configuração Operacional",
      description: "Aprenda a definir as diretrizes de custos que baseiam os cálculos.",
      onStart: () => {
        navigate("/config/custos-operacionais?startTour=true");
      }
    },
    {
      id: 3,
      title: "Planejamento de Missão",
      description: "Crie um P Trab real utilizando todas as ferramentas aprendidas.",
      onStart: () => {
        navigate("/ptrab/novo");
      }
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GhostModeBanner />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de P Trab</h1>
              <p className="text-muted-foreground">Visualize e gerencie todos os seus Planos de Trabalho.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('instruction-hub:open'))} className="gap-2">
                <Rocket className="h-4 w-4" />
                Centro de Instrução
              </Button>
              <Button onClick={() => navigate("/ptrab/novo")} className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Novo P Trab
              </Button>
            </div>
          </div>

          <InstructionHub missions={missions} completedMissions={completedMissions} />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar P Trab por número, operação ou OM..." className="pl-10" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <PtrabTable />
          </div>
        </div>
      </main>

      <WelcomeModal 
        open={showWelcome} 
        onOpenChange={setShowWelcome} 
        status={status} 
      />
    </div>
  );
};

export default Index;