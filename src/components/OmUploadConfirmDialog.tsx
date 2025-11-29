import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Check, XCircle } from "lucide-react";
import { OMAnalysisResult } from "@/pages/OmBulkUploadPage";
import { Badge } from "@/components/ui/badge";

interface OmUploadConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisResult: OMAnalysisResult;
  onConfirm: () => void;
  loading: boolean;
}

export function OmUploadConfirmDialog({ open, onOpenChange, analysisResult, onConfirm, loading }: OmUploadConfirmDialogProps) {
  const totalNewOms = analysisResult.newOms.length;
  const totalUpdatedOms = analysisResult.updatedOms.length;
  const totalErrors = analysisResult.errors.length;
  const totalWarnings = analysisResult.warnings.length;
  
  const totalOmsToProcess = totalNewOms + totalUpdatedOms;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Confirmação de Upload de OMs
          </DialogTitle>
          <DialogDescription>
            O arquivo foi analisado. Revise as alterações antes de confirmar a importação.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4 text-sm">
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <h4 className="font-semibold">Resumo da Operação</h4>
            <div className="flex justify-between">
              <span>OMs Novas a Serem Criadas:</span>
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">{totalNewOms}</Badge>
            </div>
            <div className="flex justify-between">
              <span>OMs Existentes a Serem Atualizadas:</span>
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">{totalUpdatedOms}</Badge>
            </div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>Total de OMs a Processar:</span>
              <span>{totalOmsToProcess}</span>
            </div>
          </div>

          {(totalErrors > 0 || totalWarnings > 0) && (
            <div className="space-y-2 p-3 border rounded-lg bg-yellow-50/50 border-yellow-300">
              <h4 className="font-semibold flex items-center gap-2 text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                Alertas e Erros
              </h4>
              <div className="flex justify-between">
                <span>Erros de Validação (Linhas Ignoradas):</span>
                <Badge variant="destructive">{totalErrors}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Avisos (Dados Incompletos/Inconsistentes):</span>
                <Badge variant="secondary">{totalWarnings}</Badge>
              </div>
              {analysisResult.multipleCodugs.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2">
                    Aviso: {analysisResult.multipleCodugs.length} OM(s) possuem múltiplos CODUGs. Apenas o primeiro será considerado.
                </div>
              )}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Ao confirmar, as OMs novas serão criadas e as existentes serão atualizadas com os dados do arquivo.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading || totalOmsToProcess === 0}>
            {loading ? "Processando..." : `Confirmar Importação (${totalOmsToProcess})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}