"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, PlayCircle, Trophy, GraduationCap, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { useSession } from '@/components/SessionContextProvider';
import { getCompletedMissions, isMissionCompleted } from '@/lib/missionUtils';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Mission {
  id: number;
  title: string;
  description: string;
  targetPath: string;
  category: 'logistica' | 'operacional' | 'gestao';
}

const MISSIONS: Mission[] = [
  { id: 1, title: "Gestão do P Trab", description: "Conheça as ferramentas de controle e o ciclo de vida dos planos.", targetPath: "/ptrab", category: 'gestao' },
  { id: 2, title: "Inteligência PNCP", description: "Aprenda a importar itens reais de atas do Governo Federal.", targetPath: "/config/custos-operacionais", category: 'operacional' },
  { id: 3, title: "Detalhamento Operacional", description: "Lance necessidades de material de consumo vinculadas a OMs.", targetPath: "/ptrab/form", category: 'operacional' },
  { id: 4, title: "Contabilidade Gerencial", description: "Analise o impacto financeiro e distribuição por OM.", targetPath: "/ptrab/form", category: 'gestao' },
  { id: 5, title: "Editor de DOR", description: "Redija o Documento de Oficialização da Requisição com agilidade.", targetPath: "/ptrab/dor", category: 'gestao' },
  { id: 6, title: "Anexos e Exportação", description: "Gere relatórios técnicos em PDF e Excel para o processo.", targetPath: "/ptrab/print", category: 'gestao' },
];

export const InstructionHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para carregar o progresso atualizado
  const refreshProgress = () => {
    if (user?.id) {
      const completed = getCompletedMissions(user.id);
      setCompletedIds(completed);
    }
  };

  useEffect(() => {
    if (user?.id) {
      refreshProgress();
      setLoading(false);

      // Ouve o evento global de conclusão de missão para atualizar a UI em tempo real
      const handleMissionComplete = (event: any) => {
        if (event.detail?.userId === user.id || !event.detail?.userId) {
          refreshProgress();
        }
      };

      window.addEventListener('mission:completed', handleMissionComplete);
      return () => window.removeEventListener('mission:completed', handleMissionComplete);
    }
  }, [user?.id]);

  const startMission = async (mission: Mission) => {
    // 1. Define as flags de treinamento
    localStorage.setItem('is_ghost_mode', 'true');
    localStorage.setItem('active_mission_id', mission.id.toString());
    
    // 2. Limpa o cache das consultas principais para forçar a leitura do GHOST_DATA
    await queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
    await queryClient.invalidateQueries({ queryKey: ['ptrabTotals'] });
    await queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais'] });
    
    toast.success(`Missão "${mission.title}" iniciada no modo de treinamento.`);
    
    const path = mission.targetPath.includes('?') 
      ? `${mission.targetPath}&startTour=true` 
      : `${mission.targetPath}?startTour=true`;
      
    navigate(path);
  };

  const totalCompleted = completedIds.length;
  const progressPercent = Math.round((totalCompleted / MISSIONS.length) * 100);

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-6 rounded-lg border border-border">
        <div className="space-y-1">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Seu Progresso de Instrução
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete todas as missões para dominar o P Trab Inteligente.
          </p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-48 h-3 bg-secondary rounded-full overflow-hidden border border-border">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm font-bold whitespace-nowrap">{totalCompleted} / {MISSIONS.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MISSIONS.map((mission) => {
          const isDone = completedIds.includes(mission.id);
          
          return (
            <Card key={mission.id} className={cn(
              "relative overflow-hidden transition-all border-2",
              isDone ? "bg-green-50/10 border-green-500/30" : "hover:border-primary/50"
            )}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-1">
                  <Badge variant="outline" className="text-[10px] uppercase">Missão {mission.id}</Badge>
                  {isDone && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                <CardTitle className="text-lg">{mission.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {mission.description}
                </CardDescription>
                
                <Button 
                  onClick={() => startMission(mission)}
                  variant={isDone ? "outline" : "default"}
                  className="w-full group"
                  size="sm"
                >
                  {isDone ? (
                    <>Revisar Missão <ArrowRight className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Iniciar Missão <PlayCircle className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform" /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};