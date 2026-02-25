"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, CheckCircle2, Lock, Medal, ArrowRight, ShieldCheck, Database, FileText, BarChart3, Printer } from "lucide-react";
import { useSession } from './SessionContextProvider';
import { getCompletedMissions } from '@/lib/missionUtils';
import { enterGhostMode } from '@/lib/ghostStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const MISSIONS = [
  {
    id: 1,
    title: "Gerenciamento de Planos",
    description: "Aprenda a navegar no painel principal, criar P Trabs e usar ferramentas de colaboração.",
    icon: FileText,
    path: "/ptrab",
    startTour: true
  },
  {
    id: 2,
    title: "Inteligência PNCP",
    description: "Configure diretrizes de custos e importe dados reais do PNCP para suas referências.",
    icon: Database,
    path: "/config/custos-operacionais",
    startTour: true
  },
  {
    id: 3,
    title: "Detalhamento Operacional",
    description: "Lance necessidades de material de consumo e serviços com memórias de cálculo automáticas.",
    icon: ShieldCheck,
    path: "/ptrab/form",
    startTour: true
  },
  {
    id: 4,
    title: "Contabilidade Gerencial",
    description: "Analise o impacto financeiro global e distribuído por Organização Militar.",
    icon: BarChart3,
    path: "/ptrab/form",
    startTour: true
  },
  {
    id: 5,
    title: "Editor de DOR",
    description: "Gere o Documento de Oficialização da Requisição integrado aos dados do seu P Trab.",
    icon: Printer,
    path: "/ptrab/dor",
    startTour: true
  },
  {
    id: 6,
    title: "Resultados e Exportação",
    description: "Visualize relatórios consolidados e aprenda a exportar para PDF e Excel.",
    icon: Medal,
    path: "/ptrab/print",
    startTour: true
  }
];

export const InstructionHub: React.FC = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const completed = user ? getCompletedMissions(user.id) : [];

  const handleStartMission = (mission: typeof MISSIONS[0]) => {
    // Ativa o Modo Fantasma
    enterGhostMode(mission.id.toString());
    
    // Navega para o destino com o parâmetro de tour
    const targetPath = `${mission.path}?ptrabId=ghost-ptrab-123&startTour=true`;
    navigate(targetPath);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {MISSIONS.map((mission, index) => {
        const isCompleted = completed.includes(mission.id);
        const isLocked = index > 0 && !completed.includes(MISSIONS[index - 1].id);
        
        return (
          <Card key={mission.id} className={cn(
            "relative overflow-hidden transition-all hover:shadow-md border-2",
            isCompleted ? "border-green-200 bg-green-50/30" : "border-muted bg-card",
            isLocked && "opacity-80 grayscale"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  isCompleted ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                )}>
                  <mission.icon className="h-5 w-5" />
                </div>
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isLocked ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[10px] uppercase">Disponível</Badge>
                )}
              </div>
              <CardTitle className="text-base">M{mission.id}: {mission.title}</CardTitle>
              <CardDescription className="text-xs line-clamp-2">{mission.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                size="sm" 
                className="w-full" 
                variant={isCompleted ? "outline" : "default"}
                disabled={isLocked}
                onClick={() => handleStartMission(mission)}
              >
                {isCompleted ? "Revisar Missão" : "Iniciar Missão"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};