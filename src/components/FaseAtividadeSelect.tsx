import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FASES_PADRAO } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FaseAtividadeSelectProps {
  value: string; // String formatada: "Fase1; Fase2; Customizada"
  onChange: (value: string) => void;
  disabled: boolean;
}

// Função auxiliar para parsear a string de fases
const parseFases = (value: string) => {
    const allFases = value.split(';').map(f => f.trim()).filter(f => f);
    const standardFases = allFases.filter(f => FASES_PADRAO.includes(f));
    const customFase = allFases.find(f => !FASES_PADRAO.includes(f)) || "";
    return { standardFases, customFase };
};

export function FaseAtividadeSelect({ value, onChange, disabled }: FaseAtividadeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { standardFases, customFase } = parseFases(value);
  const [tempCustomFase, setTempCustomFase] = React.useState(customFase);
  const [tempStandardFases, setTempStandardFases] = React.useState(standardFases);

  React.useEffect(() => {
      setTempCustomFase(customFase);
      setTempStandardFases(standardFases);
  }, [value]);

  const handleStandardFaseChange = (fase: string, checked: boolean) => {
    setTempStandardFases(prev => {
        const newFases = checked 
            ? Array.from(new Set([...prev, fase]))
            : prev.filter(f => f !== fase);
        
        // Atualiza o valor final imediatamente
        const finalValue = [...newFases, tempCustomFase.trim()].filter(f => f).join('; ');
        onChange(finalValue);
        return newFases;
    });
  };
  
  const handleCustomFaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCustomFase = e.target.value;
      setTempCustomFase(newCustomFase);
      
      // Atualiza o valor final imediatamente
      const finalValue = [...tempStandardFases, newCustomFase.trim()].filter(f => f).join('; ');
      onChange(finalValue);
  };

  const displayValue = [...standardFases, customFase].filter(f => f).join(', ');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10"
          disabled={disabled}
        >
          <span className="truncate">
            {displayValue || "Selecione a(s) fase(s)..."}
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
                onSelect={() => handleStandardFaseChange(fase, !tempStandardFases.includes(fase))}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={tempStandardFases.includes(fase)}
                    onCheckedChange={(checked) => handleStandardFaseChange(fase, !!checked)}
                  />
                  <Label>{fase}</Label>
                </div>
                {tempStandardFases.includes(fase) && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandGroup>
          <div className="p-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
            <Input
              value={tempCustomFase}
              onChange={handleCustomFaseChange}
              placeholder="Ex: Patrulhamento"
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}