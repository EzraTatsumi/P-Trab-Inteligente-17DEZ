import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plane, Check, AlertTriangle, MapPin, Calendar, ChevronDown, ChevronUp, X } from "lucide-react";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { formatCurrency, formatCodug, formatDate } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Tipo de retorno esperado pelo PassagemForm
export interface TrechoSelection {
    om_detentora: string;
    ug_detentora: string;
    diretriz_id: string;
    trecho_id: string;
    origem: string;
    destino: string;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
    valor_unitario: number;
    // Novo campo para armazenar a quantidade de passagens para este trecho
    quantidade_passagens: number; 
}

interface PassagemTrechoSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Agora onSelect recebe uma lista de TrechoSelection
  onSelect: (trechos: TrechoSelection[]) => void; 
  selectedYear: number;
  // Novo: Lista de trechos já selecionados para pré-preenchimento
  initialSelections: TrechoSelection[];
}

const fetchDiretrizesPassagens = async (year: number): Promise<DiretrizPassagem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('diretrizes_passagens')
    .select('*')
    .eq('user_id', user.id)
    .eq('ano_referencia', year)
    .eq('ativo', true)
    .order('om_referencia', { ascending: true });

  if (error) {
    console.error("Erro ao buscar diretrizes de passagens:", error);
    throw new Error("Falha ao carregar contratos de passagens.");
  }

  return data as DiretrizPassagem[];
};

const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
  selectedYear,
  initialSelections = [],
}) => {
  const { data: diretrizes, isLoading, isError } = useQuery({
    queryKey: ['diretrizesPassagens', selectedYear],
    queryFn: () => fetchDiretrizesPassagens(selectedYear),
    enabled: open,
  });
  
  // Estado para armazenar os trechos selecionados (incluindo a quantidade)
  const [currentSelections, setCurrentSelections] = useState<TrechoSelection[]>([]);
  
  // Estado para controlar qual diretriz está aberta
  const [openDiretrizId, setOpenDiretrizId] = useState<string | null>(null);

  // Inicializa o estado com as seleções iniciais
  useEffect(() => {
    if (open) {
        setCurrentSelections(initialSelections);
    }
  }, [open, initialSelections]);
  
  // Função para adicionar/remover trecho
  const handleToggleTrecho = (diretriz: DiretrizPassagem, trecho: TrechoPassagem) => {
    const trechoKey = `${diretriz.id}-${trecho.id}`;
    const existingIndex = currentSelections.findIndex(s => 
        s.diretriz_id === diretriz.id && s.trecho_id === trecho.id
    );

    if (existingIndex !== -1) {
      // Remover
      setCurrentSelections(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      // Adicionar
      const newSelection: TrechoSelection = {
        om_detentora: diretriz.om_referencia,
        ug_detentora: diretriz.ug_referencia,
        diretriz_id: diretriz.id,
        trecho_id: trecho.id,
        origem: trecho.origem,
        destino: trecho.destino,
        tipo_transporte: trecho.tipo_transporte,
        is_ida_volta: trecho.is_ida_volta,
        valor_unitario: trecho.valor,
        quantidade_passagens: 1, // Valor inicial
      };
      setCurrentSelections(prev => [...prev, newSelection]);
    }
  };
  
  // Função para atualizar a quantidade de passagens
  const handleUpdateQuantity = (diretrizId: string, trechoId: string, quantity: number) => {
    setCurrentSelections(prev => prev.map(s => {
      if (s.diretriz_id === diretrizId && s.trecho_id === trechoId) {
        return { ...s, quantidade_passagens: quantity };
      }
      return s;
    }));
  };

  const handleConfirmSelection = () => {
    if (currentSelections.length === 0) {
      toast.error("Selecione pelo menos um trecho.");
      return;
    }
    
    const invalidQuantity = currentSelections.some(s => s.quantidade_passagens <= 0);
    if (invalidQuantity) {
        toast.error("A quantidade de passagens deve ser maior que zero para todos os trechos selecionados.");
        return;
    }

    onSelect(currentSelections);
    onOpenChange(false);
  };
  
  const totalSelectedValue = useMemo(() => {
      return currentSelections.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade_passagens * (s.is_ida_volta ? 2 : 1)), 0);
  }, [currentSelections]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Selecionar Trechos de Passagem
          </DialogTitle>
          <DialogDescription>
            Selecione um ou mais trechos de contratos (Diretrizes) para a solicitação.
            <span className="block mt-1 text-xs text-red-600">
                Apenas contratos ativos para o ano {selectedYear} são exibidos.
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Carregando diretrizes...</span>
          </div>
        ) : isError || !diretrizes || diretrizes.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-40 text-center p-4">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum contrato de passagens ativo encontrado para o ano {selectedYear}. 
              Cadastre-os em "Configurações > Custos Operacionais".
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {diretrizes.map((diretriz) => (
              <Collapsible 
                key={diretriz.id} 
                open={openDiretrizId === diretriz.id}
                onOpenChange={(open) => {
                    setOpenDiretrizId(open ? diretriz.id : null);
                }}
                className="border rounded-lg"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col text-left">
                      <h4 className="font-semibold text-base">
                        {diretriz.om_referencia} (UG: {formatCodug(diretriz.ug_referencia)})
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Pregão: {diretriz.numero_pregao || 'N/A'} | Vigência: {formatDate(diretriz.data_inicio_vigencia)} a {formatDate(diretriz.data_fim_vigencia)}
                      </p>
                    </div>
                    {openDiretrizId === diretriz.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t bg-background">
                  <div className="p-4 space-y-3">
                    <h5 className="font-medium text-sm mb-2">Selecione os Trechos:</h5>
                    {/* CORREÇÃO: Garantir que trechos seja tratado como array de TrechoPassagem */}
                    {(diretriz.trechos as unknown as TrechoPassagem[]).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center">Nenhum trecho cadastrado neste contrato.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(diretriz.trechos as unknown as TrechoPassagem[]).map((trecho) => {
                                const isSelected = currentSelections.some(s => 
                                    s.diretriz_id === diretriz.id && s.trecho_id === trecho.id
                                );
                                const currentQuantity = currentSelections.find(s => 
                                    s.diretriz_id === diretriz.id && s.trecho_id === trecho.id
                                )?.quantidade_passagens || 1;
                                
                                return (
                                    <div
                                        key={trecho.id}
                                        className={cn(
                                            "p-3 border rounded-md cursor-pointer transition-all",
                                            isSelected
                                                ? "border-primary ring-2 ring-primary/50 bg-primary/10"
                                                : "hover:bg-muted"
                                        )}
                                        onClick={() => handleToggleTrecho(diretriz, trecho)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm flex items-center gap-1">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                {trecho.origem} &rarr; {trecho.destino}
                                            </span>
                                            {isSelected ? <Check className="h-4 w-4 text-primary" /> : <Plane className="h-4 w-4 text-muted-foreground" />}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            <span className="font-medium">{trecho.tipo_transporte}</span> | 
                                            <span className="ml-1">{trecho.is_ida_volta ? 'Ida e Volta' : 'Somente Ida'}</span>
                                        </div>
                                        <div className="text-sm font-bold mt-1 flex justify-between items-center">
                                            <span>{formatCurrency(trecho.valor)}</span>
                                            {isSelected && (
                                                <div className="flex items-center gap-2">
                                                    <label htmlFor={`qty-${trecho.id}`} className="text-xs font-normal text-muted-foreground">Qtd:</label>
                                                    <input
                                                        id={`qty-${trecho.id}`}
                                                        type="number"
                                                        min={1}
                                                        value={currentQuantity}
                                                        onChange={(e) => {
                                                            const qty = parseInt(e.target.value) || 1;
                                                            handleUpdateQuantity(diretriz.id, trecho.id, qty);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()} // Previne o toggle ao clicar no input
                                                        className="w-16 p-1 border rounded text-center text-sm font-medium text-foreground"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
        
        {/* Resumo da Seleção */}
        <div className="pt-4 border-t space-y-3">
            <h4 className="font-semibold text-base">Resumo da Seleção</h4>
            <div className="flex justify-between items-center p-3 border rounded-md bg-muted/50">
                <span className="font-medium">Trechos Selecionados:</span>
                <span className="font-bold text-lg text-primary">{currentSelections.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-md bg-muted/50">
                <span className="font-medium">Valor Total Estimado:</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(totalSelectedValue)}</span>
            </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleConfirmSelection} 
            disabled={currentSelections.length === 0 || isLoading}
          >
            Confirmar Seleção ({currentSelections.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemTrechoSelectorDialog;