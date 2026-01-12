import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Copy, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface YearManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableYears: number[];
  defaultYear: number | null;
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
  const nextYear = currentYear + 1;
  
  // Inicializa sourceYear com o ano mais recente disponível ou o ano atual
  const initialSourceYear = availableYears.length > 0 ? Math.max(...availableYears) : currentYear;
  
  const [sourceYear, setSourceYear] = useState<number | null>(initialSourceYear);
  const [targetYear, setTargetYear] = useState<number | null>(nextYear);
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      // Reset states when opening the dialog
      setSourceYear(availableYears.length > 0 ? Math.max(...availableYears) : currentYear);
      setTargetYear(nextYear);
      setYearToDelete(null);
    }
  }, [open, availableYears]);

  const handleCopy = async () => {
    if (!sourceYear || !targetYear) {
      toast.error("Selecione o ano de origem e o ano de destino.");
      return;
    }
    if (sourceYear === targetYear) {
      toast.error("O ano de origem e o ano de destino devem ser diferentes.");
      return;
    }
    if (availableYears.includes(targetYear)) {
      toast.error(`O ano ${targetYear} já possui diretrizes cadastradas. Exclua-o primeiro.`);
      return;
    }
    
    await onCopy(sourceYear, targetYear);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!yearToDelete) {
      toast.error("Selecione o ano que deseja excluir.");
      return;
    }
    if (yearToDelete === defaultYear) {
      toast.error("Não é possível excluir o ano definido como padrão.");
      return;
    }
    
    await onDelete(yearToDelete);
    onOpenChange(false);
  };
  
  const handleTargetYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === "") {
        setTargetYear(null);
    } else {
        // Remove caracteres não numéricos e tenta parsear
        const cleanedValue = value.replace(/\D/g, '');
        const numValue = parseInt(cleanedValue);
        
        if (!isNaN(numValue)) {
            setTargetYear(numValue);
        } else if (cleanedValue === "") {
            // Se o usuário apagou tudo, mas o parseInt falhou (ex: só tinha um '-' ou '+')
            setTargetYear(null);
        }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Gerenciar Anos de Diretriz
          </DialogTitle>
          <DialogDescription>
            Crie novos anos copiando dados de um ano existente ou exclua diretrizes antigas.
          </DialogDescription>
        </DialogHeader>
        
        {/* Seção de Cópia */}
        <div className="space-y-4 border-b pb-4">
          <h4 className="font-semibold flex items-center gap-2 text-lg text-primary">
            <Copy className="h-4 w-4" /> Copiar Diretrizes
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-year">Copiar de (Ano de Origem)</Label>
              <Select
                value={sourceYear?.toString() || ""}
                onValueChange={(value) => setSourceYear(parseInt(value))}
                disabled={loading || availableYears.length === 0}
              >
                <SelectTrigger id="source-year">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year} {year === defaultYear && "(Padrão)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableYears.length === 0 && (
                <p className="text-xs text-red-500">Nenhum ano salvo para copiar.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-year">Criar para (Ano de Destino)</Label>
              <Input
                id="target-year"
                type="number"
                min={nextYear}
                placeholder={nextYear.toString()}
                // Garante que o valor seja string vazia se for null, ou o número como string
                value={targetYear === null ? "" : targetYear.toString()} 
                onChange={handleTargetYearChange}
                disabled={loading}
                // Classes para remover as setas
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          <Button 
            onClick={handleCopy} 
            className="w-full" 
            disabled={loading || !sourceYear || !targetYear || availableYears.includes(targetYear)}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Copiar e Criar Ano {targetYear}
          </Button>
        </div>
        
        {/* Seção de Exclusão */}
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="h-4 w-4" /> Excluir Diretrizes
          </h4>
          <div className="space-y-2">
            <Label htmlFor="delete-year">Ano a Excluir</Label>
            <Select
              value={yearToDelete?.toString() || ""}
              onValueChange={(value) => setYearToDelete(parseInt(value))}
              disabled={loading || availableYears.length === 0}
            >
              <SelectTrigger id="delete-year">
                <SelectValue placeholder="Selecione o ano para exclusão" />
              </SelectTrigger>
              <SelectContent>
                {availableYears
                  .filter(year => year !== defaultYear) // Não permite excluir o ano padrão
                  .map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year} {year === defaultYear && "(Padrão)"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {availableYears.length === 0 && (
                <p className="text-xs text-red-500">Nenhum ano salvo para excluir.</p>
            )}
            {yearToDelete === defaultYear && (
                <p className="text-xs text-red-500">Não é possível excluir o ano padrão.</p>
            )}
          </div>
          <Button 
            onClick={handleDelete} 
            className="w-full" 
            variant="destructive"
            disabled={loading || !yearToDelete || yearToDelete === defaultYear}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Excluir Diretrizes do Ano {yearToDelete}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};