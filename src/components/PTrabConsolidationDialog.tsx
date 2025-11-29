import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ArrowRight, Plus, AlertCircle, ChevronsUpDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type PTrab = Tables<'p_trab'>;

interface PTrabConsolidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePTrabId: string;
  onConsolidateSuccess: () => void;
}

export function PTrabConsolidationDialog({ open, onOpenChange, sourcePTrabId, onConsolidateSuccess }: PTrabConsolidationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [targetPTrabId, setTargetPTrabId] = useState<string | null>(null);
  const [availablePTrabs, setAvailablePTrabs] = useState<PTrab[]>([]);
  const [sourcePTrab, setSourcePTrab] = useState<PTrab | null>(null);

  useEffect(() => {
    if (open) {
      loadPTrabs();
    }
  }, [open, sourcePTrabId]);

  const loadPTrabs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all PTrabs for the user
      const { data: allPTrabs, error: fetchError } = await supabase
        .from('p_trab')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Separate source PTrab and available targets
      const source = allPTrabs.find(p => p.id === sourcePTrabId);
      setSourcePTrab(source || null);

      // Targets are other PTrabs that are not the source
      const targets = allPTrabs.filter(p => p.id !== sourcePTrabId);
      setAvailablePTrabs(targets);
      setTargetPTrabId(null); // Reset target selection
      
    } catch (error) {
      console.error("Erro ao carregar P Trabs:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleConsolidate = async () => {
    if (!sourcePTrabId || !targetPTrabId) {
      toast.error("Selecione um P Trab de destino.");
      return;
    }

    if (!confirm(`Tem certeza que deseja CONSOLIDAR os dados do P Trab de origem (${sourcePTrab?.numero_ptrab}) no P Trab de destino? Esta ação é irreversível e pode duplicar registros se o destino já tiver dados.`)) {
      return;
    }

    setLoading(true);
    try {
      // Chamada para a função RPC de consolidação
      const { data, error } = await supabase.rpc('consolidate_ptrab_data', {
        source_ptrab_id: sourcePTrabId,
        target_ptrab_id: targetPTrabId,
      });

      if (error) throw error;

      toast.success(`Consolidação concluída! ${data.total_records} registros transferidos/atualizados.`);
      onConsolidateSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao consolidar P Trabs:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const targetPTrab = availablePTrabs.find(p => p.id === targetPTrabId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Plus className="h-5 w-5" />
            Consolidar P-Trab
          </DialogTitle>
          <DialogDescription>
            Transfira todos os registros de Classe I, II e III do P-Trab de origem para um P-Trab de destino.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 text-sm">
          <div className="p-3 border rounded-lg bg-muted/50 flex items-center justify-between">
            <span className="font-semibold">P-Trab de Origem:</span>
            <span className="font-bold text-primary">{sourcePTrab?.numero_ptrab || 'Carregando...'}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-ptrab">P-Trab de Destino *</Label>
            <Select
              value={targetPTrabId || ""}
              onValueChange={setTargetPTrabId}
              disabled={loading || availablePTrabs.length === 0}
            >
              <SelectTrigger id="target-ptrab">
                <SelectValue placeholder="Selecione o P-Trab de destino..." />
              </SelectTrigger>
              <SelectContent>
                {availablePTrabs.map((ptrab) => (
                  <SelectItem key={ptrab.id} value={ptrab.id}>
                    {ptrab.numero_ptrab} - {ptrab.nome_operacao} ({formatCurrency(ptrab.valor_total || 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availablePTrabs.length === 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Nenhum outro P-Trab disponível para consolidação.
                </p>
            )}
          </div>
          
          <div className="p-3 border rounded-lg bg-red-50/50 border-red-300 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
                Atenção: A consolidação irá copiar os registros de Classe I, II e III do P-Trab de origem para o P-Trab de destino. Se o P-Trab de destino já possuir registros, eles serão mantidos e os novos serão adicionados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConsolidate} 
            disabled={loading || !targetPTrabId}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {loading ? "Consolidando..." : "Confirmar Consolidação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}