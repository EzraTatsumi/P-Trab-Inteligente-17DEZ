import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import React from "react";

interface FaseAtividadeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const FASES_ATIVIDADE = [
  "Planejamento",
  "Preparação",
  "Execução",
  "Conclusão",
  "Pós-Operação",
];

export const FaseAtividadeSelector: React.FC<FaseAtividadeSelectorProps> = ({ value, onChange, disabled = false }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="fase_atividade">Fase da Atividade</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="fase_atividade">
          <SelectValue placeholder="Selecione a fase" />
        </SelectTrigger>
        <SelectContent>
          {FASES_ATIVIDADE.map((fase) => (
            <SelectItem key={fase} value={fase}>
              {fase}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};