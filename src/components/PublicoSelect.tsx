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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const OPCOES_PADRAO = ["OSP", "Civis", "Militares"];

interface PublicoSelectProps {
  value: string; // String formatada: "OSP; Civis; Outro"
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Função auxiliar para parsear a string de públicos
const parsePublicos = (value: string) => {
    const allPublicos = value.split(';').map(p => p.trim()).filter(p => p);
    const standardPublicos = allPublicos.filter(p => OPCOES_PADRAO.includes(p));
    const customPublico = allPublicos.find(p => !OPCOES_PADRAO.includes(p)) || "";
    return { standardPublicos, customPublico };
};

export function PublicoSelect({ value, onChange, disabled }: PublicoSelectProps) {
  const [open, setOpen] = React.useState(false);
  const { standardPublicos, customPublico } = parsePublicos(value || "");
  const [tempCustomPublico, setTempCustomPublico] = React.useState(customPublico);
  const [tempStandardPublicos, setTempStandardPublicos] = React.useState(standardPublicos);

  React.useEffect(() => {
      setTempCustomPublico(customPublico);
      setTempStandardPublicos(standardPublicos);
  }, [value]);

  const handleStandardPublicoChange = (opcao: string, checked: boolean) => {
    setTempStandardPublicos(prev => {
        const newPublicos = checked 
            ? Array.from(new Set([...prev, opcao]))
            : prev.filter(p => p !== opcao);
        
        const finalValue = [...newPublicos, tempCustomPublico.trim()].filter(p => p).join('; ');
        onChange(finalValue);
        return newPublicos;
    });
  };
  
  const handleCustomPublicoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCustom = e.target.value;
      setTempCustomPublico(newCustom);
      
      const finalValue = [...tempStandardPublicos, newCustom.trim()].filter(p => p).join('; ');
      onChange(finalValue);
  };

  const displayValue = [...standardPublicos, customPublico].filter(p => p).join(', ');

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
            {displayValue || "Selecione o público..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[300px] p-0" 
        align="start"
        onMouseLeave={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
      >
        <Command>
          <CommandGroup>
            {OPCOES_PADRAO.map((opcao) => (
              <CommandItem
                key={opcao}
                value={opcao}
                onSelect={() => handleStandardPublicoChange(opcao, !tempStandardPublicos.includes(opcao))}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={tempStandardPublicos.includes(opcao)}
                    onCheckedChange={(checked) => handleStandardPublicoChange(opcao, !!checked)}
                  />
                  <Label className="cursor-pointer">{opcao}</Label>
                </div>
                {tempStandardPublicos.includes(opcao) && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandGroup>
          <div className="p-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Outro Público (Opcional)</Label>
            <Input
              value={tempCustomPublico}
              onChange={handleCustomPublicoChange}
              placeholder="Ex: Visitantes"
              className="h-8 text-sm"
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}