"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface RMOption {
  name: string;
  codug: string;
}

interface RmSelectorProps {
  value?: string; // O nome da RM selecionada
  onChange: (rmName: string, rmCodug: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RmSelector({
  value,
  onChange,
  placeholder = "Selecione uma RM...",
  disabled = false,
}: RmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [rms, setRMs] = useState<RMOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRMs();
  }, []);

  const loadRMs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('rm_vinculacao, codug_rm_vinculacao')
        .eq('ativo', true);

      if (error) throw error;

      const uniqueRMsMap = new Map<string, RMOption>();
      (data || []).forEach(om => {
        if (!uniqueRMsMap.has(om.rm_vinculacao)) {
          uniqueRMsMap.set(om.rm_vinculacao, {
            name: om.rm_vinculacao,
            codug: om.codug_rm_vinculacao,
          });
        }
      });

      const sortedRMs = Array.from(uniqueRMsMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setRMs(sortedRMs);
    } catch (error) {
      console.error('Erro ao carregar RMs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {loading ? (
            "Carregando..."
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar RM..." />
          <CommandList>
            <CommandEmpty>Nenhuma RM encontrada.</CommandEmpty>
            <CommandGroup>
              {rms.map((rm) => (
                <CommandItem
                  key={rm.name}
                  value={rm.name}
                  onSelect={(currentValue) => {
                    const selected = rms.find(r => r.name === currentValue);
                    if (selected) {
                      onChange(selected.name, selected.codug);
                    } else {
                      onChange("", ""); // Limpar se não encontrado
                    }
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === rm.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{rm.name}</span>
                    <span className="text-xs text-muted-foreground">
                      CODUG: {rm.codug}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}