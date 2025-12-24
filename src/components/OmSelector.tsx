"use client";

import { useState, useEffect, useMemo } from "react";
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
import { OMData } from "@/lib/omUtils";

interface OmSelectorProps {
  selectedOmId?: string; // ID da OM selecionada
  onChange: (omData: OMData | undefined) => void; // Passa o objeto OMData completo
  filterByRM?: string;
  placeholder?: string;
  disabled?: boolean;
  omsList?: OMData[]; // Lista de OMs pré-carregada
  defaultOmId?: string; // ID da OM padrão a ser sugerida
  currentOmName?: string; // NOVO: Nome atual da OM (vindo do field.value do formulário)
  initialOmUg?: string; // UG inicial da OM
}

export function OmSelector({
  selectedOmId,
  onChange,
  filterByRM,
  placeholder = "Selecione uma OM...",
  disabled = false,
  omsList,
  defaultOmId,
  currentOmName, // USANDO O NOVO NOME DA PROP
  initialOmUg,
}: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [oms, setOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayOM, setDisplayOM] = useState<OMData | undefined>(undefined);
  const [isFetchingSelected, setIsFetchingSelected] = useState(false);

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

  // 1. Carrega OMs (da prop ou do DB)
  useEffect(() => {
    if (omsList) {
      setOms(omsList);
      setLoading(false);
    } else {
      loadOMs();
    }
  }, [filterByRM, omsList]);

  // 2. Lógica para sugerir a OM padrão automaticamente
  useEffect(() => {
    if (!loading && !selectedOmId && defaultOmId && oms.length > 0) {
      const defaultOM = oms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        onChange(defaultOM);
      }
    }
  }, [loading, selectedOmId, defaultOmId, oms, onChange]);

  // 3. Efeito para garantir que a OM selecionada seja exibida, mesmo que não esteja na lista 'oms'
  useEffect(() => {
    if (!selectedOmId) {
      setDisplayOM(undefined);
      return;
    }

    const foundInList = oms.find(om => om.id === selectedOmId);
    
    if (foundInList) {
      setDisplayOM(foundInList);
      setIsFetchingSelected(false); 
      return;
    }

    const fetchSelectedOM = async () => {
      setIsFetchingSelected(true);
      
      try {
        const { data } = await supabase
          .from('organizacoes_militares')
          .select('*')
          .eq('id', selectedOmId)
          .maybeSingle();
        
        setDisplayOM((data || undefined) as OMData | undefined);
      } catch (error) {
        console.error('Erro ao buscar OM selecionada:', error);
      } finally {
        setIsFetchingSelected(false);
      }
    };

    fetchSelectedOM();
    
  }, [selectedOmId, oms]);

  const isOverallLoading = loading || isFetchingSelected;

  // Lógica de exibição do texto no botão
  const buttonText = useMemo(() => {
    // 1. Se um objeto OM completo foi carregado (via ID lookup)
    if (displayOM) {
      return displayOM.nome_om;
    }
    
    // 2. Se o formulário já tem um nome salvo (modo de edição), exibe-o imediatamente.
    // Isso garante que o nome apareça mesmo que a lista de OMs ainda esteja carregando.
    if (currentOmName) {
      return currentOmName;
    }
    
    // 3. Se estiver carregando, mostra o placeholder de carregamento
    if (isOverallLoading) {
      return "Carregando OMs...";
    }
    
    // 4. Default
    return placeholder;
  }, [isOverallLoading, displayOM, currentOmName, placeholder]);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isOverallLoading}
        >
          {/* Ajuste na classe: Muta apenas se o texto for o placeholder */}
          <span className={cn("truncate", buttonText === placeholder && "text-muted-foreground")}>
            {buttonText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar OM..." />
          <CommandList>
            <CommandEmpty>Nenhuma OM encontrada.</CommandEmpty>
            <CommandGroup>
              {oms.map((om) => (
                <CommandItem
                  key={om.id}
                  value={`${om.nome_om} ${om.codug_om} ${om.rm_vinculacao} ${om.id}`} 
                  onSelect={(currentValue) => {
                    const selected = oms.find(o => o.id === om.id);
                    onChange(selected?.id === selectedOmId ? undefined : selected);
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
                      CODUG: {om.codug_om} | {om.rm_vinculacao}
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