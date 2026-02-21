"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, CheckCircle2, ShieldCheck, Database, FileEdit, BarChart3, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const MISSIONS = [
  { id: 1, title: "01: Centro de Comando", icon: ShieldCheck, desc: "Gestão e clonagem de P Trabs no Manager.", path: "/ptrab" },
  { id: 2, title: "02: Inteligência PNCP", icon: Database, desc: "Importação automática via API do PNCP.", path: "/config/custos-operacionais" },
  { id: 3, title: "03: Linha de Frente", icon: FileEdit, desc: "A lógica das 5 seções do formulário.", path: "/ptrab/form" },
  { id: 4, title: "04: Monitoramento", icon: BarChart3, desc: "Contabilidade gerencial e limites de OM.", path: "/ptrab/form" },
  { id: 5, title: "05: Redação Técnica", icon: FileText, desc: "Geração automática do Editor DOR.", path: "/ptrab/dor" },
  { id: 6, title: "06: Entrega Final", icon: Send, desc: "Gerenciamento e exportação de relatórios.", path: "/ptrab/print" },
];

export const InstructionHub = () => {
  const [completed, setCompleted] = React.useState<number[]>([]);

  React.useEffect(() => {
    const saved = localStorage.getItem('completed_missions');
    if (saved) setCompleted(JSON.parse(saved));
  }, []);

  const startMission = (path: string, id: number) => {
    localStorage.setItem('is_ghost_mode', 'true');
    localStorage.setItem('active_mission_id', id.toString());
    
    // Se for missão de formulário, precisamos de um ID fictício na URL
    const finalPath = (id === 3 || id === 4) ? `${path}?ptrabId=ghost-ptrab-123&startTour=true` : `${path}?startTour=true`;
    window.location.href = finalPath;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Sala de Briefing</h2>
        <p className="text-muted-foreground text-sm">Complete as missões de instrução para dominar o P Trab Inteligente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MISSIONS.map((m) => {
          const isDone = completed.includes(m.id);
          
          return (
            <Card key={m.id} className={cn(
              "relative overflow-hidden transition-all hover:shadow-md border-2",
              isDone ? "border-green-500/30 bg-green-50/5" : "border-transparent"
            )}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDone ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
                  )}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  {isDone && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluída
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{m.title}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{m.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => startMission(m.path, m.id)}
                  variant={isDone ? "outline" : "default"}
                  size="sm"
                  className="w-full gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  {isDone ? "Revisar Instrução" : "Iniciar Missão"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};