"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trophy, PlayCircle, CheckCircle2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/components/SessionContextProvider";
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
  const { user } = useSession();
  
  // Se estiver em modo fantasma, escondemos o hub para dar foco à missão
  const isMissionInProgress = isGhostMode();

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

  if (!isOpen || isMissionInProgress) return null;

  const progress = (completedMissions.length / missions.length) * 100;

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl">Centro de Instrução</CardTitle>
              <CardDescription>Conclua as missões para dominar o sistema</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Progresso de Ativação</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {missions.map((mission) => {
            const isCompleted = completedMissions.includes(mission.id);
            return (
              <div 
                key={mission.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isCompleted 
                    ? "bg-green-50 border-green-200" 
                    : "bg-white border-dashed border-muted-foreground/20"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-bold ${isCompleted ? "text-green-800" : "text-foreground"}`}>
                    {mission.id}. {mission.title}
                  </h4>
                  {isCompleted && <Trophy className="h-4 w-4 text-green-600" />}
                </div>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  {mission.description}
                </p>
                <Button 
                  size="sm" 
                  variant={isCompleted ? "outline" : "primary"} 
                  className="w-full gap-2"
                  onClick={() => {
                    mission.onStart();
                    // O hub se fechará automaticamente via isMissionInProgress
                  }}
                >
                  {isCompleted ? (
                    <><CheckCircle2 className="h-4 w-4" /> Refazer</>
                  ) : (
                    <><PlayCircle className="h-4 w-4" /> Iniciar</>
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