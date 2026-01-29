' por '>' no texto.">
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
import { Loader2, Plane, Check, AlertTriangle, MapPin, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { formatCurrency, formatCodug, formatDate } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Tipo de retorno esperado pelo PassagemForm
interface TrechoSelection {
    om_detentora: string;
    ug_detentora: string;
    diretriz_id: string;
    trecho_id: string;
    origem: string;
    destino: string;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
    valor_unitario: number;
}

interface PassagemTrechoSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (trecho: TrechoSelection) => void;
  selectedYear: number;
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
}) => {
  const { data: diretrizes, isLoading, isError } = useQuery({
    queryKey: ['diretrizesPassagens', selectedYear],
    queryFn: () => fetchDiretrizesPassagens(selectedYear),
    enabled: open,
  });
  
  const [selectedDiretrizId, setSelectedDiretrizId] = useState<string | null>(null);
  const [selectedTrechoId, setSelectedTrechoId] = useState<string | null>(null);

  const selectedDiretriz = useMemo(() => {
    return diretrizes?.find(d => d.id === selectedDiretrizId) || null;
  }, [diretrizes, selectedDiretrizId]);

  const selectedTrecho = useMemo(() => {
    if (!selectedDiretriz || !selectedTrechoId) return null;
    // Trechos é um array de objetos JSONB, precisamos garantir que a busca seja correta
    const trechosArray = selectedDiretriz.trechos as unknown as TrechoPassagem[];
    return trechosArray.find(t => t.id === selectedTrechoId) || null;
  }, [selectedDiretriz, selectedTrechoId]);

  const handleConfirmSelection = () => {
    if (!selectedDiretriz || !selectedTrecho) {
      toast.error("Selecione um trecho válido.");
      return;
    }

    const selection: TrechoSelection = {
      om_detentora: selectedDiretriz.om_referencia,
      ug_detentora: selectedDiretriz.ug_referencia,
      diretriz_id: selectedDiretriz.id,
      trecho_id: selectedTrecho.id,
      origem: selectedTrecho.origem,
      destino: selectedTrecho.destino,
      tipo_transporte: selectedTrecho.tipo_transporte,
      is_ida_volta: selectedTrecho.is_ida_volta,
      valor_unitario: selectedTrecho.valor,
    };

    onSelect(selection);
    onOpenChange(false);
  };
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
        setSelectedDiretrizId(null);
        setSelectedTrechoId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Selecionar Trecho de Passagem
          </DialogTitle>
          <DialogDescription>
            Selecione o contrato (Diretriz) e o trecho específico para a solicitação.
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
                open={selectedDiretrizId === diretriz.id}
                onOpenChange={(open) => {
                    setSelectedDiretrizId(open ? diretriz.id : null);
                    setSelectedTrechoId(null); // Reset trecho ao mudar de diretriz
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
                    <ChevronDown className={cn("h-4 w-4 transition-transform", selectedDiretrizId === diretriz.id && "rotate-180")} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t bg-background">
                  <div className="p-4 space-y-3">
                    <h5 className="font-medium text-sm mb-2">Selecione o Trecho:</h5>
                    {/* CORREÇÃO: Garantir que trechos seja tratado como array de TrechoPassagem */}
                    {(diretriz.trechos as unknown as TrechoPassagem[]).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center">Nenhum trecho cadastrado neste contrato.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(diretriz.trechos as unknown as TrechoPassagem[]).map((trecho) => (
                                <div
                                    key={trecho.id}
                                    className={cn(
                                        "p-3 border rounded-md cursor-pointer transition-all",
                                        selectedTrechoId === trecho.id
                                            ? "border-primary ring-2 ring-primary/50 bg-primary/10"
                                            : "hover:bg-muted"
                                    )}
                                    onClick={() => setSelectedTrechoId(trecho.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm flex items-center gap-1">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            {trecho.origem} &rarr; {trecho.destino}
                                        </span>
                                        {selectedTrechoId === trecho.id && <Check className="h-4 w-4 text-primary" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        <span className="font-medium">{trecho.tipo_transporte}</span> | 
                                        <span className="ml-1">{trecho.is_ida_volta ? 'Ida e Volta' : 'Somente Ida'}</span>
                                    </div>
                                    <div className="text-sm font-bold mt-1">
                                        {formatCurrency(trecho.valor)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleConfirmSelection} 
            disabled={!selectedTrecho || isLoading}
          >
            Confirmar Seleção
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemTrechoSelectorDialog;