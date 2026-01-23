"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { formatCodug } from "@/lib/formatUtils";
import { useGlobalMilitaryOrganizations } from "@/hooks/useGlobalMilitaryOrganizations"; // NEW IMPORT

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
  globalMode?: boolean; // NOVO PROP: Indica se deve buscar OMs globais (user_id IS NULL)
}

export function OmSelector({
  selectedOmId,
  onChange,
  filterByRM,
  placeholder = "Selecione a OM de Destino", // AJUSTADO: Placeholder padrão conforme solicitação
  disabled = false,
  omsList, // Usar a lista passada se existir
  defaultOmId, // Recebe o ID padrão
  initialOmName, // NOVO
  initialOmUg, // NOVO
  globalMode = false, // NOVO DEFAULT
}: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [localOms, setLocalOms] = useState<OMData[]>([]); // Renomeado 'oms' para 'localOms'
  const [loading, setLoading] = useState(true);
  // NOVO ESTADO: Armazena os dados da OM selecionada, especialmente se ela não estiver na lista 'localOms'
  const [displayOM, setDisplayOM] = useState<OMData | undefined>(undefined);
  const [isFetchingSelected, setIsFetchingSelected] = useState(false); // Novo estado para carregar a OM selecionada
  
  // NOVO: Ref para controlar se a OM inicial foi carregada e notificada ao pai
  const initialLoadRef = useRef(false); 

  // NEW: Fetch global OMs if globalMode is true
  const { data: globalOms, isLoading: isLoadingGlobalOms } = useGlobalMilitaryOrganizations();

  const loadOMs = async () => {
    setLoading(true);
    try {
      let data: OMData[] = [];
      
      if (globalMode) {
          // Se globalMode, usa os dados do hook (que já filtra por user_id IS NULL)
          data = globalOms || [];
      } else {
          // Lógica existente para buscar OMs do usuário ou filtradas
          let query = supabase
            .from('organizacoes_militares')
            .select('*')
            .eq('ativo', true)
            .order('nome_om');

          if (filterByRM) {
            query = query.eq('rm_vinculacao', filterByRM);
          }

          const { data: dbData } = await query;
          data = (dbData || []) as OMData[];
      }
      
      setLocalOms(data);
    } catch (error) {
      console.error('Erro ao carregar OMs:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Carrega OMs (da prop, do DB ou do hook global)
  useEffect(() => {
    if (omsList) {
      setLocalOms(omsList);
      setLoading(false);
    } else if (globalMode) {
        // Se globalMode, confia no estado do hook
        setLocalOms(globalOms || []);
        setLoading(isLoadingGlobalOms);
    } else {
      // Se não for globalMode nem omsList, carrega do DB (user-specific/all)
      loadOMs();
    }
  }, [filterByRM, omsList, globalMode, globalOms, isLoadingGlobalOms]);

  // 2. Lógica para sugerir a OM padrão automaticamente
  useEffect(() => {
    if (!loading && !selectedOmId && defaultOmId && localOms.length > 0 && !initialLoadRef.current) {
      const defaultOM = localOms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        onChange(defaultOM);
        setDisplayOM(defaultOM); 
        initialLoadRef.current = true;
      }
    }
  }, [loading, selectedOmId, defaultOmId, localOms, onChange]);

  // 3. Efeito para garantir que a OM selecionada seja exibida
  useEffect(() => {
    if (!selectedOmId) {
      if (initialOmName && initialOmUg) {
        setDisplayOM({
          id: 'temp', 
          nome_om: initialOmName,
          codug_om: initialOmUg,
          rm_vinculacao: '', 
          codug_rm_vinculacao: '', 
          cidade: '', 
          ativo: false, 
        } as OMData);
      } else {
        setDisplayOM(undefined);
      }
      return;
    }

    const foundInList = localOms.find(om => om.id === selectedOmId);
    
    if (foundInList) {
      setDisplayOM(foundInList);
      setIsFetchingSelected(false); 
      
      if (!initialLoadRef.current) {
          onChange(foundInList);
          initialLoadRef.current = true;
      }
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
        
        const fetchedOM = (data || undefined) as OMData | undefined;
        setDisplayOM(fetchedOM);
        
        if (fetchedOM && !initialLoadRef.current) {
            onChange(fetchedOM);
            initialLoadRef.current = true;
        }
        
      } catch (error) {
        console.error('Erro ao buscar OM selecionada:', error);
      } finally {
        setIsFetchingSelected(false);
      }
    };

    // Se não for globalMode, ou se a OM não foi encontrada na lista local, busca individualmente.
    if (!globalMode || !loading) {
        fetchSelectedOM();
    }
    
  }, [selectedOmId, localOms, initialOmName, initialOmUg, onChange, globalMode, loading]); 

  const isOverallLoading = loading || isFetchingSelected;

  const buttonText = useMemo(() => {
    if (displayOM) {
      return displayOM.nome_om;
    }
    
    if (selectedOmId && (isFetchingSelected || initialOmName)) {
        return initialOmName || "Carregando OM...";
    }
    
    if (loading) {
      return "Carregando...";
    }
    
    return placeholder;
  }, [loading, displayOM, selectedOmId, isFetchingSelected, initialOmName, placeholder]);


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
          <span className={cn("truncate", !selectedOmId && !displayOM && !initialOmName && "text-muted-foreground")}>
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
              {localOms.map((om) => (
                <CommandItem
                  key={om.id}
                  value={`${om.nome_om} ${om.codug_om} ${om.rm_vinculacao} ${om.id}`} 
                  onSelect={() => {
                    const selected = localOms.find(o => o.id === om.id); 
                    
                    const newSelection = selected?.id === selectedOmId ? undefined : selected;
                    
                    onChange(newSelection); 
                    setDisplayOM(newSelection); 
                    setOpen(false);
                    
                    initialLoadRef.current = false; 
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOmId === om.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{om.nome_om}</span>
                    <span className="text-xs text-muted-foreground">
                      CODUG: {formatCodug(om.codug_om)} | {om.rm_vinculacao}
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