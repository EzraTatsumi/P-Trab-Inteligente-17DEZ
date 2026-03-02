"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { OMData } from "@/lib/omUtils";
import { formatCodug } from "@/lib/formatUtils";

interface OmSelectorProps {
  selectedOmId?: string;
  onChange: (omData: OMData | undefined) => void;
  filterByRM?: string;
  placeholder?: string;
  disabled?: boolean;
  omsList?: OMData[];
  defaultOmId?: string;
  initialOmName?: string;
  initialOmUg?: string;
}

export function OmSelector({
  selectedOmId,
  onChange,
  filterByRM,
  placeholder = "Selecione a OM de Destino",
  disabled = false,
  omsList,
  defaultOmId,
  initialOmName,
  initialOmUg,
}: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [oms, setOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const initialLoadRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Efeito para resetar o scroll ao digitar na busca
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [searchTerm]);

  const loadOMs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('ativo', true)
        .order('nome_om');

      if (filterByRM) {
        query = query.eq('rm_vinculacao', filterByRM);
      }

      const { data } = await query;
      setOms((data || []) as OMData[]);
    } catch (error) {
      console.error('Erro ao carregar OMs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (omsList) {
      setOms(omsList);
      setLoading(false);
    } else {
      loadOMs();
    }
  }, [filterByRM, omsList]);

  useEffect(() => {
    if (!loading && !selectedOmId && defaultOmId && oms.length > 0 && !initialLoadRef.current) {
      const defaultOM = oms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        onChange(defaultOM);
        initialLoadRef.current = true;
      }
    }
  }, [loading, selectedOmId, defaultOmId, oms, onChange]);

  const selectedOMData = useMemo(() => {
    if (selectedOmId === 'temp' && initialOmName && initialOmUg) {
      return {
        id: 'temp',
        nome_om: initialOmName,
        codug_om: initialOmUg,
        rm_vinculacao: '',
        codug_rm_vinculacao: '',
        cidade: '',
        ativo: false,
      } as OMData;
    }
    return oms.find(om => om.id === selectedOmId);
  }, [selectedOmId, oms, initialOmName, initialOmUg]);

  const buttonText = useMemo(() => {
    if (selectedOMData) return selectedOMData.nome_om;
    if (initialOmName) return initialOmName;
    if (loading) return "Carregando...";
    return placeholder;
  }, [loading, selectedOMData, initialOmName, placeholder]);

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
          <span className={cn("truncate", !selectedOmId && !initialOmName && "text-muted-foreground")}>
            {buttonText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar OM..." 
            onValueChange={setSearchTerm}
          />
          <CommandList ref={scrollRef}>
            {loading ? (
              <CommandItem disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando OMs...
              </CommandItem>
            ) : (
              <>
                <CommandEmpty>Nenhuma OM encontrada.</CommandEmpty>
                <CommandGroup>
                  {oms.map((om) => (
                    <CommandItem
                      key={om.id}
                      value={`${om.nome_om} ${om.codug_om} ${om.rm_vinculacao}`}
                      onSelect={() => {
                        onChange(om);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedOmId === om.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{om.nome_om}</span>
                        <span className="text-xs text-muted-foreground">
                          UG: {formatCodug(om.codug_om)} | RM: {om.rm_vinculacao}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}