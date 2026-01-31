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
import { formatCodug } from "@/lib/formatUtils"; // Adicionado formatCodug

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
  placeholder = "Selecione a OM de Destino", // AJUSTADO: Placeholder padrão conforme solicitação
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
  
  // NOVO: Ref para controlar se a OM inicial foi carregada e notificada ao pai
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

  // 2. Lógica para sugerir a OM padrão automaticamente (Ajustado para só rodar se não houver selectedOmId)
  useEffect(() => {
    if (!loading && !selectedOmId && defaultOmId && oms.length > 0 && !initialLoadRef.current) {
      const defaultOM = oms.find(om => om.id === defaultOmId);
      if (defaultOM) {
        // Chama onChange para definir a OM padrão no estado pai
        onChange(defaultOM);
        setDisplayOM(defaultOM); // Define o displayOM imediatamente
        initialLoadRef.current = true;
      }
    }
  }, [loading, selectedOmId, defaultOmId, oms, onChange]);

  // 3. Efeito para garantir que a OM selecionada seja exibida, mesmo que não esteja na lista 'oms' (e.g., inativa)
  useEffect(() => {
    if (!selectedOmId) {
      // Se não houver ID selecionado, mas houver nome/UG inicial (modo de edição sem ID ativo ou preenchimento automático),
      // criamos um objeto temporário para exibição.
      if (initialOmName && initialOmUg) {
        setDisplayOM({
          id: 'temp', // ID temporário
          nome_om: initialOmName,
          codug_om: initialOmUg,
          rm_vinculacao: '', // Placeholder
          codug_rm_vinculacao: '', // Placeholder
          cidade: '', // Placeholder
          ativo: false, // Assumimos inativo/não encontrado
        } as OMData);
      } else {
        setDisplayOM(undefined);
      }
      return;
    }

    // 1. Tenta encontrar na lista de OMs ativas/filtradas
    const foundInList = oms.find(om => om.id === selectedOmId);
    
    if (foundInList) {
      setDisplayOM(foundInList);
      setIsFetchingSelected(false); 
      
      // Notifica o pai se for a primeira carga e o ID foi fornecido
      if (!initialLoadRef.current) {
          onChange(foundInList);
          initialLoadRef.current = true;
      }
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
        
        const fetchedOM = (data || undefined) as OMData | undefined;
        setDisplayOM(fetchedOM);
        
        // Notifica o pai após a busca assínrona
        if (fetchedOM && !initialLoadRef.current) {
            onChange(fetchedOM);
            initialLoadRef.current = true;
        }
        
      } catch (error) {
        console.error('Erro ao buscar OM selecionada:', error);
        // Se falhar, displayOM permanece undefined
      } finally {
        setIsFetchingSelected(false);
      }
    };

    // Dispara a busca individual imediatamente se o ID estiver presente e não encontrado na lista atual.
    fetchSelectedOM();
    
  }, [selectedOmId, oms, initialOmName, initialOmUg, onChange]); // Adicionado initialOmName/Ug para re-executar se o contexto de edição mudar

  const isOverallLoading = loading || isFetchingSelected;

  // Lógica de exibição do texto no botão (AJUSTADA)
  const buttonText = useMemo(() => {
    // 1. Se a OM completa foi carregada (displayOM), use o nome dela.
    if (displayOM) {
      return displayOM.nome_om;
    }
    
    // 2. Se não houver ID selecionado, mas houver um nome inicial (usado para preenchimento automático/fallback), use-o.
    if (!selectedOmId && initialOmName) {
        return initialOmName;
    }
    
    // 3. Se estiver em modo de edição (selectedOmId existe) E a OM ainda está sendo buscada, 
    //    ou se o ID não foi encontrado, mas temos o nome inicial (fallback para edição).
    if (selectedOmId && (isFetchingSelected || initialOmName)) {
        return initialOmName || "Carregando OM...";
    }
    
    // 4. Se estiver carregando a lista de OMs (loading)
    if (loading) {
      return "Carregando...";
    }
    
    // 5. Caso contrário, mostre o placeholder.
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Buscar OM..." />
          <CommandList>
            {isOverallLoading ? (
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