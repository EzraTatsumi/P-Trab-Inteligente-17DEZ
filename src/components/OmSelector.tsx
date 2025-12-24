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
  selectedOmId?: string; // Agora recebe o ID da OM selecionada
  onChange: (omData: OMData | undefined) => void; // Passa o objeto OMData completo
  filterByRM?: string;
  placeholder?: string;
  disabled?: boolean;
  omsList?: OMData[]; // Novo prop: lista de OMs pré-carregada
  defaultOmId?: string; // NOVO: ID da OM padrão a ser sugerida
  initialOmName?: string; // NOVO: Nome inicial da OM para exibição imediata
  initialOmUg?: string; // NOVO: UG inicial da OM
}

export function OmSelector({
  selectedOmId,
  onChange,
  filterByRM,
  placeholder = "Selecione uma OM...",
  disabled = false,
  omsList, // Usar a lista passada se existir
  defaultOmId, // Recebe o ID padrão
  initialOmName, // NOVO
  initialOmUg, // NOVO
}: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [oms, setOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  // NOVO ESTADO: Armazena os dados da OM selecionada, especialmente se ela não estiver na lista 'oms' (e.g., inativa)
  const [displayOM, setDisplayOM] = useState<OMData | undefined>(undefined);
  const [isFetchingSelected, setIsFetchingSelected] = useState(false); // Novo estado para carregar a OM selecionada

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
    // Só executa se o carregamento estiver completo, se não houver OM selecionada,
    // se um ID padrão for fornecido e se a lista de OMs estiver populada.
    if (!loading && !selectedOmId && defaultOmId && oms.length > 0) {
      const defaultOM = oms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        // Chama onChange para definir a OM padrão no estado pai
        onChange(defaultOM);
      }
    }
  }, [loading, selectedOmId, defaultOmId, oms, onChange]);

  // 3. Efeito para garantir que a OM selecionada seja exibida, mesmo que não esteja na lista 'oms' (e.g., inativa)
  useEffect(() => {
    if (!selectedOmId) {
      setDisplayOM(undefined);
      return;
    }

    // 1. Tenta encontrar na lista de OMs ativas/filtradas
    const foundInList = oms.find(om => om.id === selectedOmId);
    
    if (foundInList) {
      setDisplayOM(foundInList);
      setIsFetchingSelected(false); 
      return;
    }

    // 2. Se não for encontrada, busca diretamente pelo ID (pode ser inativa ou fora do filtro)
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
        // Se falhar, displayOM permanece undefined
      } finally {
        setIsFetchingSelected(false);
      }
    };

    // Dispara a busca individual imediatamente se o ID estiver presente e não encontrado na lista atual.
    fetchSelectedOM();
    
  }, [selectedOmId, oms]); // Removido 'loading' das dependências para esta busca

  const isOverallLoading = loading || isFetchingSelected;

  // Lógica de exibição do texto no botão
  const buttonText = useMemo(() => {
    if (isOverallLoading) {
      // Se estiver carregando, mas tivermos um nome inicial, mostre o nome inicial
      if (selectedOmId && initialOmName) {
        return initialOmName;
      }
      return "Carregando...";
    }
    
    if (displayOM) {
      // Se a OM completa foi carregada, use o nome dela
      return displayOM.nome_om;
    }
    
    if (selectedOmId && initialOmName) {
      // Se o ID está presente, mas a busca falhou ou a OM não está na lista, use o nome inicial
      return initialOmName;
    }
    
    // Caso contrário, mostre o placeholder
    return placeholder;
  }, [isOverallLoading, displayOM, selectedOmId, initialOmName, placeholder]);


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
          <span className={cn("truncate", !selectedOmId && !displayOM && "text-muted-foreground")}>
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
                  // Alterado o valor para incluir nome e CODUG, melhorando a busca do cmdk
                  value={`${om.nome_om} ${om.codug_om} ${om.rm_vinculacao} ${om.id}`} 
                  onSelect={(currentValue) => {
                    // O currentValue agora é a string completa, precisamos encontrar o ID
                    const selected = oms.find(o => o.id === om.id); // Usamos o om.id do loop para garantir a seleção correta
                    onChange(selected?.id === selectedOmId ? undefined : selected); // Passa o objeto completo ou undefined
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