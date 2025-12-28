import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCodug } from "@/lib/formatUtils";

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ClasseIIFormHeaderProps {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  efetivo: number;
  dias_operacao: number;
  fasesAtividade: string[];
  customFaseAtividade: string;
  isPopoverOpen: boolean;
  
  onOMChange: (omData: OMData | undefined) => void;
  onEfetivoChange: (value: number) => void;
  onDiasOperacaoChange: (value: number) => void;
  onFaseChange: (fase: string, checked: boolean) => void;
  onCustomFaseChange: (value: string) => void;
  onPopoverOpenChange: (open: boolean) => void;
}

export const ClasseIIFormHeader: React.FC<ClasseIIFormHeaderProps> = ({
  selectedOmId,
  organizacao,
  ug,
  efetivo,
  dias_operacao,
  fasesAtividade,
  customFaseAtividade,
  isPopoverOpen,
  onOMChange,
  onEfetivoChange,
  onDiasOperacaoChange,
  onFaseChange,
  onCustomFaseChange,
  onPopoverOpenChange,
}) => {
  const { handleEnterToNextField } = useFormNavigation();

  const displayFases = useMemo(() => {
    return [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  }, [fasesAtividade, customFaseAtividade]);
  
  // Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    handleEnterToNextField(e);
  };

  return (
    <div className="space-y-3 border-b pb-4">
      <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
      
      {/* PRIMEIRA LINHA: OM Detentora, UG Detentora, Efetivo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>OM Detentora do Equipamento *</Label>
          <OmSelector
            selectedOmId={selectedOmId}
            onChange={onOMChange}
            placeholder="Selecione a OM..."
            initialOmName={organizacao} 
            initialOmUg={ug} 
          />
        </div>

        <div className="space-y-2">
          <Label>UG Detentora</Label>
          <Input 
            value={formatCodug(ug)} 
            readOnly 
            disabled 
            onKeyDown={handleEnterToNextField} 
          />
        </div>
        
        <div className="space-y-2">
          <Label>Efetivo Empregado *</Label>
          <Input
            type="number"
            min="1"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
            value={efetivo || ""}
            onChange={(e) => onEfetivoChange(parseInt(e.target.value) || 0)}
            placeholder="Ex: 100"
            onKeyDown={handleNumberInputKeyDown}
          />
        </div>
      </div>
      
      {/* SEGUNDA LINHA: Dias de Atividade, Fase da Atividade (2 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Dias de Atividade *</Label>
          <Input
            type="number"
            min="1"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
            value={dias_operacao || ""}
            onChange={(e) => onDiasOperacaoChange(parseInt(e.target.value) || 0)}
            placeholder="Ex: 7"
            onKeyDown={handleNumberInputKeyDown}
          />
        </div>
        
        <div className="space-y-2 col-span-2">
          <Label>Fase da Atividade *</Label>
          <Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                type="button"
                className="w-full justify-between"
                disabled={!organizacao}
              >
                <span className="truncate">
                  {displayFases || "Selecione a(s) fase(s)..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandGroup>
                  {FASES_PADRAO.map((fase) => (
                    <CommandItem
                      key={fase}
                      value={fase}
                      onSelect={() => onFaseChange(fase, !fasesAtividade.includes(fase))}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={fasesAtividade.includes(fase)}
                          onCheckedChange={(checked) => onFaseChange(fase, !!checked)}
                        />
                        <Label>{fase}</Label>
                      </div>
                      {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <div className="p-2 border-t">
                  <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                  <Input
                    value={customFaseAtividade}
                    onChange={(e) => onCustomFaseChange(e.target.value)}
                    placeholder="Ex: Patrulhamento"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};