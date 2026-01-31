import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface YearManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableYears: number[];
  defaultYear: number | null; // Adicionado para resolver o erro
  onCopy: (sourceYear: number, targetYear: number) => Promise<void>;
  onDelete: (year: number) => Promise<void>;
  loading: boolean;
}

export const YearManagementDialog: React.FC<YearManagementDialogProps> = ({
  open,
  onOpenChange,
  availableYears,
  defaultYear,
  onCopy,
  onDelete,
  loading,
}) => {
  const currentYear = new Date().getFullYear();
  const [sourceYear, setSourceYear] = useState<number | null>(availableYears.length > 0 ? availableYears[0] : null);
  const [targetYear, setTargetYear] = useState<number>(currentYear + 1);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  // Atualiza o ano de origem quando a lista de anos disponíveis muda
  React.useEffect(() => {
    if (availableYears.length > 0 && !sourceYear) {
      setSourceYear(availableYears[0]);
    }
  }, [availableYears, sourceYear]);

  const yearsToCopyFrom = useMemo(() => availableYears.filter(y => y !== targetYear).sort((a, b) => b - a), [availableYears, targetYear]);
  const yearsToDelete = useMemo(() => availableYears.filter(y => y !== defaultYear).sort((a, b) => b - a), [availableYears, defaultYear]);

  const handleCopy = async () => {
    if (!sourceYear) {
      toast.error("Selecione um ano de origem.");
      return;
    }
    if (availableYears.includes(targetYear)) {
      toast.error(`O ano de destino ${targetYear} já possui diretrizes cadastradas.`);
      return;
    }
    if (targetYear <= 0) {
        toast.error("Ano de destino inválido.");
        return;
    }
    
    await onCopy(sourceYear, targetYear);
    setTargetYear(currentYear + 1);
  };

  const handleDelete = async () => {
    if (!yearToDelete) {
      toast.error("Selecione um ano para excluir.");
      return;
    }
    await onDelete(yearToDelete);
    setYearToDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Anos de Diretrizes</DialogTitle>
          <DialogDescription>
            Copie diretrizes de um ano para o outro ou exclua anos não utilizados.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          
          {/* Seção de Cópia */}
          <div className="space-y-3 border p-4 rounded-lg">
            <h4 className="font-semibold flex items-center">
              <Copy className="h-4 w-4 mr-2" /> Copiar Diretrizes
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-year">Ano de Origem</Label>
                <Select
                  value={sourceYear?.toString() || ''}
                  onValueChange={(value) => setSourceYear(parseInt(value))}
                  disabled={loading || yearsToCopyFrom.length === 0}
                >
                  <SelectTrigger id="source-year">
                    <SelectValue placeholder="Selecione o ano de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearsToCopyFrom.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === defaultYear && "(Padrão)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-year">Ano de Destino (Novo)</Label>
                <Input
                  id="target-year"
                  type="number"
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value) || currentYear + 1)}
                  min={currentYear}
                  disabled={loading}
                />
              </div>
            </div>
            <Button 
              onClick={handleCopy} 
              disabled={loading || !sourceYear || availableYears.includes(targetYear)}
              className="w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Copiar e Criar Novo Ano"}
            </Button>
            {availableYears.includes(targetYear) && (
                <p className="text-xs text-red-500">O ano de destino já existe.</p>
            )}
          </div>
          
          {/* Seção de Exclusão */}
          <div className="space-y-3 border p-4 rounded-lg">
            <h4 className="font-semibold flex items-center">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Diretrizes
            </h4>
            <div className="space-y-2">
              <Label htmlFor="delete-year">Ano para Excluir</Label>
              <Select
                value={yearToDelete?.toString() || ''}
                onValueChange={(value) => setYearToDelete(parseInt(value))}
                disabled={loading || yearsToDelete.length === 0}
              >
                <SelectTrigger id="delete-year">
                  <SelectValue placeholder="Selecione o ano para excluir" />
                </SelectTrigger>
                <SelectContent>
                  {yearsToDelete.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {yearsToDelete.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum ano disponível para exclusão (o ano padrão não pode ser excluído).</p>
              )}
            </div>
            <Button 
              onClick={handleDelete} 
              disabled={loading || !yearToDelete}
              variant="destructive"
              className="w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Excluir Diretrizes do Ano"}
            </Button>
          </div>
          
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};