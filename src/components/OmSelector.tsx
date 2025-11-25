"use client";

import { useState, useEffect, useRef } from "react";
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
import { OMData } from "@/lib/omUtils"; // Certifique-se de que OMData está corretamente importado

interface OmSelectorProps {
  selectedOmId?: string; // Agora recebe o ID da OM selecionada
  onChange: (omData: OMData | undefined) => void; // Passa o objeto OMData completo
  filterByRM?: string;
  placeholder?: string;
  disabled?: boolean;
  omsList?: OMData[]; // Novo prop: lista de OMs pré-carregada
}

// Função auxiliar para limpar o nome da OM para fins de busca (remove acentos e caracteres não alfanuméricos)
const cleanOmNameForSearch = (name: string) => {
  // 1. Normaliza para remover acentos (NFD) e remove caracteres diacríticos ([\u0300-\u036f])
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // 2. Remove caracteres não alfanuméricos (exceto espaços) e converte para minúsculas
  return normalized.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
};

export function OmSelector({
  selectedOmId,
  onChange,
  filterByRM,
  placeholder = "Selecione uma OM...",
  disabled = false,
  omsList, // Usar a lista passada se existir
}: OmSelectorProps) {
  const [open, setOpen] = useState(false);
  const [oms, setOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Ref para o CommandInput
  const inputRef = useRef<HTMLInputElement>(null); 

  // Se omsList for fornecido, usa ele. Caso contrário, carrega do Supabase.
  useEffect(() => {
    if (omsList) {
      setOms(omsList);
      setLoading(false);
    } else {
      loadOMs();
    }
  }, [filterByRM, omsList]);

  // Efeito para focar o input quando o popover abre
  useEffect(() => {
    if (open) {
      // Pequeno delay para garantir que o PopoverContent esteja montado
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10); 
      return () => clearTimeout(timer);
    }
  }, [open]);

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

  const selectedOM = oms.find(om => om.id === selectedOmId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Se o popover já estiver aberto, não precisamos fazer nada aqui.
    if (open) return;

    // Verifica se a tecla pressionada é um caractere de pesquisa (letra, número, etc.)
    const isSearchKey = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

    if (isSearchKey) {
      // Previne o comportamento padrão do botão (como o Enter ou Space)
      e.preventDefault(); 
      
      // Abre o popover
      setOpen(true);
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
          onKeyDown={handleKeyDown} // Adiciona o handler de teclado
        >
          {loading ? (
            "Carregando..."
          ) : selectedOM ? (
            // Exibe apenas o nome da OM (sigla)
            <span className="truncate">{selectedOM.nome_om}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-w-[400px] p-0" align="start">
        <Command>
          <CommandInput ref={inputRef} placeholder="Buscar OM..." />
          <CommandList>
            <CommandEmpty>Nenhuma OM encontrada.</CommandEmpty>
            <CommandGroup>
              {oms.map((om) => (
                <CommandItem
                  key={om.id}
                  // Inclui o nome original, o nome limpo, CODUG e RM para busca
                  value={`${om.nome_om} ${cleanOmNameForSearch(om.nome_om)} ${om.codug_om} ${om.rm_vinculacao} ${om.id}`} 
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