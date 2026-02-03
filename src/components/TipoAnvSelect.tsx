import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ANV_PADRAO } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface TipoAnvSelectProps {
  value: string; // String da aeronave selecionada ou customizada
  onChange: (value: string) => void;
  disabled: boolean;
}

// Função auxiliar para determinar se o valor é padrão ou customizado
const parseAnv = (value: string) => {
    const trimmedValue = value.trim();
    const isStandard = ANV_PADRAO.includes(trimmedValue);
    
    return { 
        selectedStandardAnv: isStandard ? trimmedValue : "", 
        customAnv: isStandard ? "" : trimmedValue 
    };
};

export function TipoAnvSelect({ value, onChange, disabled }: TipoAnvSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { selectedStandardAnv, customAnv } = parseAnv(value);
  const [tempCustomAnv, setTempCustomAnv] = React.useState(customAnv);

  React.useEffect(() => {
      const { customAnv: initialCustom } = parseAnv(value);
      setTempCustomAnv(initialCustom);
  }, [value]);

  const handleStandardAnvSelect = (anv: string) => {
    // Se a ANV padrão for selecionada, limpa o customizado e define o valor
    onChange(anv);
    setTempCustomAnv("");
    setOpen(false);
  };
  
  const handleCustomAnvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCustomAnv = e.target.value;
      setTempCustomAnv(newCustomAnv);
      
      // Atualiza o valor final imediatamente
      onChange(newCustomAnv.trim());
  };

  const displayValue = value || "Selecione o Tipo de Anv...";

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
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0" 
        align="start"
        onMouseLeave={() => setOpen(false)} // Fecha ao sair
        onMouseEnter={() => setOpen(true)}  // Mantém aberto ao entrar
      >
        <Command>
          <CommandGroup>
            {ANV_PADRAO.map((anv) => (
              <CommandItem
                key={anv}
                value={anv}
                onSelect={() => handleStandardAnvSelect(anv)}
                className="flex items-center justify-between cursor-pointer"
              >
                <Label>{anv}</Label>
                {selectedStandardAnv === anv && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandGroup>
          <div className="p-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Outro Tipo (Opcional)</Label>
            <Input
              value={tempCustomAnv}
              onChange={handleCustomAnvChange}
              placeholder="Ex: HM-5"
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}