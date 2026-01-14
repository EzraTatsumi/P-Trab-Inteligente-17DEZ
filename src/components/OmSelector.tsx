"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { OrganizacaoMilitar } from "@/types/global";

interface OmSelectorProps {
  selectedOmId: string | null;
  onSelect: (omId: string, omName: string, ug: string) => void;
  initialOmName?: string;
  displayOM?: string;
  disabled?: boolean;
  placeholder?: string;
}

const fetchOms = async (): Promise<OrganizacaoMilitar[]> => {
  const { data, error } = await supabase.from("organizacoes_militares").select("*").eq("ativo", true).order("nome_om");
  if (error) throw new Error(error.message);
  return data;
};

export function OmSelector({ selectedOmId, onSelect, initialOmName, displayOM, disabled = false, placeholder }: OmSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const { data: oms, isLoading } = useQuery<OrganizacaoMilitar[]>({
    queryKey: ["oms"],
    queryFn: fetchOms,
  });

  const selectedOm = React.useMemo(() => {
    if (!oms) return null;
    return oms.find((om) => om.id === selectedOmId);
  }, [oms, selectedOmId]);

  const defaultPlaceholder = placeholder || "Selecione a OM de Destino";

  const buttonText = selectedOm
    ? selectedOm.nome_om
    : displayOM
    ? displayOM
    : initialOmName
    ? initialOmName
    : defaultPlaceholder;

  const handleSelect = (om: OrganizacaoMilitar) => {
    onSelect(om.id, om.nome_om, om.codug_om);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          <span className={cn("truncate", !selectedOmId && !displayOM && !initialOmName && "text-muted-foreground")}>
            {buttonText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Buscar OM..." />
          <CommandEmpty>Nenhuma OM encontrada.</CommandEmpty>
          <CommandGroup>
            {isLoading ? (
              <CommandItem disabled>Carregando...</CommandItem>
            ) : (
              oms?.map((om) => (
                <CommandItem
                  key={om.id}
                  value={om.nome_om}
                  onSelect={() => handleSelect(om)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOmId === om.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {om.nome_om} ({om.codug_om})
                </CommandItem>
              ))
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}