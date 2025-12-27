import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OMData } from "@/lib/omUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AnalysisResult {
  total: number;
  totalAposDeduplicacao: number;
  totalFinalAposCodugDeduplicacao: number; // NOVO
  duplicatasRemovidas: number;
  codugsDescartados: number; // NOVO
  unique: Partial<OMData>[];
  multipleCodugs: { nome: string; registros: Partial<OMData>[] }[];
}

interface OmUploadConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisResult: AnalysisResult;
  onConfirm: () => void;
}

export const OmUploadConfirmDialog = ({
  open,
  onOpenChange,
  analysisResult,
  onConfirm,
}: OmUploadConfirmDialogProps) => {
  const multipleCodugsCount = analysisResult.multipleCodugs.reduce(
    (sum, dup) => sum + dup.registros.length,
    0
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>⚠️ Revisão de Dados</AlertDialogTitle>
          <AlertDialogDescription>
            Algumas OMs possuem múltiplos CODUGs (características especiais) ou CODUGs duplicados. Revise os dados antes de confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Alerta de Duplicatas Removidas */}
          {(analysisResult.duplicatasRemovidas > 0 || analysisResult.codugsDescartados > 0) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Duplicatas Removidas</AlertTitle>
              <AlertDescription>
                {analysisResult.duplicatasRemovidas} registro(s) idêntico(s) removido(s).
                {analysisResult.codugsDescartados > 0 && (
                    <span className="block mt-1">
                        ⚠️ {analysisResult.codugsDescartados} registro(s) descartado(s) devido a CODUG duplicado.
                    </span>
                )}
                <span className="font-bold block mt-1">
                    Total final a ser inserido: {analysisResult.totalFinalAposCodugDeduplicacao} OMs.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Resumo Estatístico */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {analysisResult.total}
              </div>
              <div className="text-xs text-muted-foreground">Total lido</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {analysisResult.totalFinalAposCodugDeduplicacao}
              </div>
              <div className="text-xs text-muted-foreground">OMs únicas (CODUG)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {analysisResult.multipleCodugs.length}
              </div>
              <div className="text-xs text-muted-foreground">
                OMs c/ múltiplos CODUGs
              </div>
            </div>
          </div>

          {/* Tabela de OMs com Múltiplos CODUGs */}
          {analysisResult.multipleCodugs.length > 0 && (
            <div className="flex-1 overflow-hidden">
              <h3 className="text-sm font-semibold mb-2">
                OMs com múltiplos CODUGs (características especiais):
              </h3>
              <ScrollArea className="h-[250px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da OM</TableHead>
                      <TableHead>CODUGs</TableHead>
                      <TableHead>RM</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysisResult.multipleCodugs.map(({ nome, registros }) => (
                      <TableRow key={nome}>
                        <TableCell className="font-medium">{nome}</TableCell>
                        <TableCell>
                          {registros
                            .map((r) => r.codug_om)
                            .join(", ")}
                        </TableCell>
                        <TableCell>
                          {registros
                            .map((r) => r.rm_vinculacao)
                            .join(", ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-yellow-50">
                            ⚠️ {registros.length} registros
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            ✅ Confirmar Carregamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};