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
  selectedOmId?: string; // Agora recebe o ID da OM selecionada
  onChange: (omData: OMData | undefined) => void; // Passa o objeto OMData completo
  filterByRM?: string;
  placeholder?: string;
  disabled?: boolean;
  omsList?: OMData[]; // Novo prop: lista de OMs pré-carregada
  defaultOmId?: string; // ID da OM padrão a ser sugerida
  initialOmName?: string; // Nome inicial da OM para exibição imediata (fallback)
  initialOmUg?: string; // UG inicial da OM (fallback)
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
  
  // Ref para controlar se a OM inicial/padrão foi carregada e notificada ao pai
  const initialLoadRef = useRef(false); 

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

  // 2. Lógica para sugerir a OM padrão automaticamente (só roda se não houver selectedOmId)
  useEffect(() => {
    if (!loading && !selectedOmId && defaultOmId && oms.length > 0 && !initialLoadRef.current) {
      const defaultOM = oms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        // Chama onChange para definir a OM padrão no estado pai
        onChange(defaultOM);
        initialLoadRef.current = true;
      }
    }
  }, [loading, selectedOmId, defaultOmId, oms, onChange]);
  
  // 3. Encontra a OM selecionada na lista de OMs ativas
  const selectedOMData = useMemo(() => {
    // Se o selectedOmId for 'temp', significa que estamos em modo de edição e a OM não está na lista ativa.
    // Neste caso, usamos os dados iniciais (initialOmName/Ug) para criar um objeto de exibição.
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
    
    // Busca na lista de OMs ativas
    return oms.find(om => om.id === selectedOmId);
  }, [selectedOmId, oms, initialOmName, initialOmUg]);


  // Lógica de exibição do texto no botão (SIMPLIFICADA)
  const buttonText = useMemo(() => {
    // 1. Se a OM selecionada foi encontrada na lista (ou é o fallback 'temp')
    if (selectedOMData) {
      return selectedOMData.nome_om;
    }
    
    // 2. Se houver um nome inicial (fallback de edição)
    if (initialOmName) {
        return initialOmName;
    }
    
    // 3. Se estiver carregando a lista de OMs
    if (loading) {
      return "Carregando...";
    }
    
    // 4. Caso contrário, mostre o placeholder.
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
          <CommandInput placeholder="Buscar OM..." />
          <CommandList>
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