import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { OMData } from "@/lib/omUtils";
import { useAuth } from "@/hooks/useAuth";

interface OmSelectorProps {
  selectedOmId?: string;
  onChange: (omData: OMData | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OmSelector({ selectedOmId, onChange, placeholder = "Selecione a OM...", disabled = false }: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(selectedOmId || "");
  const [oms, setOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOms();
    }
  }, [user]);

  useEffect(() => {
    setValue(selectedOmId || "");
  }, [selectedOmId]);

  const fetchOms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizacoes_militares")
        .select("*")
        .eq("user_id", user?.id)
        .order("nome_om", { ascending: true });

      if (error) throw error;

      setOms(data as OMData[]);
    } catch (error) {
      console.error("Erro ao carregar OMs:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedOm = useMemo(() => {
    return oms.find((om) => om.id === value);
  }, [value, oms]);

  const handleSelect = (omId: string) => {
    const om = oms.find((o) => o.id === omId);
    if (om) {
      setValue(omId);
      onChange(om);
    } else {
      setValue("");
      onChange(undefined);
    }
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
          disabled={disabled || loading}
        >
          {selectedOm ? selectedOm.nome_om : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar OM..." />
          <CommandEmpty>OM não encontrada.</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto">
            {oms.map((om) => (
              <CommandItem
                key={om.id}
                value={`${om.nome_om} ${om.codug_om}`}
                onSelect={(searchValue) => {
                  const selected = oms.find(o => `${o.nome_om} ${o.codug_om}`.toLowerCase() === searchValue);
                  if (selected) {
                    handleSelect(selected.id);
                  }
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === om.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {om.nome_om} (UG: {om.codug_om})
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}