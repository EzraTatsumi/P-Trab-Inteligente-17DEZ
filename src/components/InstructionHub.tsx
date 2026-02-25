"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, PlayCircle, Trophy, Target, ShieldCheck, Cpu, Database, Layout } from "lucide-react";
import { useSession } from './SessionContextProvider';
import { getCompletedMissions, startMission } from '@/lib/missionUtils';
import { cn } from '@/lib/utils';

const MISSIONS = [
  { id: 1, title: "Comandante do P Trab", desc: "Aprenda a gerenciar o ciclo de vida dos seus Planos de Trabalho.", icon: Target },
  { id: 2, title: "Inteligência PNCP", desc: "Configure diretrizes importando dados do Portal Nacional de Contratações Públicas.", icon: Database },
  { id: 3, title: "Detalhamento Operacional", desc: "Lance necessidades de material de consumo e serviços com apoio da IA.", icon: Layout },
  { id: 4, title: "Contabilidade Gerencial", desc: "Analise custos consolidados e distribuição por Organização Militar.", icon: ShieldCheck },
  { id: 5, title: "Redação de DOR", desc: "Gere o Documento de Oficialização da Requisição com agrupamento inteligente.", icon: Cpu },
  { id: 6, title: "Aprovações e Relatórios", desc: "Exporte memórias de cálculo e relatórios oficiais para auditoria.", icon: Trophy },
];

export const InstructionHub = () => {
  const { user } = useSession();
  const completed = getCompletedMissions(user?.id);
  
  const handleStartMission = (id: number) => {
    startMission(id, user?.id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {MISSIONS.map((mission) => {
        const isCompleted = completed.includes(mission.id);
        const Icon = mission.icon;
        
        return (
          <Card key={mission.id} className={cn(
            "relative overflow-hidden transition-all hover:shadow-md",
            isCompleted ? "bg-green-50/30 border-green-200" : "bg-white"
          )}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className={cn(
                    "p-2 rounded-lg",
                    isCompleted ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/30" />
                )}
              </div>
              <CardTitle className="text-base mt-2">Missão {mission.id}: {mission.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-xs line-clamp-2 min-h-[2.5rem]">
                {mission.desc}
              </CardDescription>
              <Button 
                variant={isCompleted ? "outline" : "default"} 
                size="sm" 
                className="w-full h-8 gap-2 text-xs"
                onClick={() => handleStartMission(mission.id)}
              >
                {isCompleted ? "Revisar Missão" : "Iniciar Missão"}
                <PlayCircle className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};