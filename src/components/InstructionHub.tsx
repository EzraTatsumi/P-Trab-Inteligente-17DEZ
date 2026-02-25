"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trophy, PlayCircle, CheckCircle2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { isGhostMode } from "@/lib/ghostStore";

interface Mission {
  id: number;
  title: string;
  description: string;
  onStart: () => void;
}

interface InstructionHubProps {
  missions: Mission[];
  completedMissions: number[];
}

const InstructionHub = ({ missions, completedMissions }: InstructionHubProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Ocultamos o Hub se estivermos em modo simulação (missão ativa) para não poluir a tela
  const isMissionActive = isGhostMode();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('instruction-hub:open', handleOpen);
    window.addEventListener('instruction-hub:close', handleClose);
    
    return () => {
      window.removeEventListener('instruction-hub:open', handleOpen);
      window.removeEventListener('instruction-hub:close', handleClose);
    };
  }, []);

  if (!isOpen || isMissionActive) return null;

  const progress = (completedMissions.length / missions.length) * 100;

  return (
    <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl shadow-sm">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Centro de Instrução</CardTitle>
              <CardDescription>Domine as ferramentas do P Trab Inteligente</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="hover:bg-primary/10">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-sm font-semibold text-primary">
            <span>Progresso de Aprendizado</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2.5 bg-primary/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {missions.map((mission) => {
            const isCompleted = completedMissions.includes(mission.id);
            return (
              <div 
                key={mission.id}
                className={`p-4 rounded-xl border-2 transition-all group hover:shadow-md ${
                  isCompleted 
                    ? "bg-green-50/50 border-green-200" 
                    : "bg-background border-dashed border-muted-foreground/30 hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-bold text-base ${isCompleted ? "text-green-800" : "text-foreground"}`}>
                    Missão {mission.id}: {mission.title}
                  </h4>
                  {isCompleted && (
                    <div className="bg-green-100 p-1 rounded-full">
                      <Trophy className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {mission.description}
                </p>
                <Button 
                  size="sm" 
                  variant={isCompleted ? "outline" : "default"} 
                  className={cn(
                    "w-full gap-2 font-semibold h-10",
                    isCompleted ? "border-green-200 text-green-700 hover:bg-green-50" : "shadow-sm"
                  )}
                  onClick={mission.onStart}
                >
                  {isCompleted ? (
                    <><RefreshCw className="h-4 w-4" /> Refazer Missão</>
                  ) : (
                    <><PlayCircle className="h-4 w-4" /> Iniciar Treinamento</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InstructionHub;