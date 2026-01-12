import React, { useState, useMemo } from 'react';
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
import { Plus, Trash2, Copy, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from '@/lib/utils';

interface YearManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableYears: number[];
  currentYear: number;
  onCopy: (sourceYear: number, targetYear: number) => void;
  onDelete: (year: number) => void;
  loading: boolean;
}

export const YearManagementDialog: React.FC<YearManagementDialogProps> = ({
  open,
  onOpenChange,
  availableYears,
  currentYear,
  onCopy,
  onDelete,
  loading,
}) => {
  const [selectedAction, setSelectedAction] = useState<'copy' | 'delete'>('copy');
  
  // Copy/Create State
  const [sourceYear, setSourceYear] = useState<number>(availableYears[0] || currentYear);
  const [targetYearInput, setTargetYearInput] = useState<string>(String(currentYear + 1));
  
  // Delete State
  const [yearToDelete, setYearToDelete] = useState<number | null>(null);

  const nextYear = currentYear + 1;
  const isTargetYearValid = useMemo(() => {
    const year = parseInt(targetYearInput);
    return !isNaN(year) && year > currentYear && !availableYears.includes(year);
  }, [targetYearInput, currentYear, availableYears]);

  const handleCopy = () => {
    const targetYear = parseInt(targetYearInput);
    if (isTargetYearValid) {
      onCopy(sourceYear, targetYear);
    }
  };

  const handleDelete = () => {
    if (yearToDelete && yearToDelete !== currentYear) {
      onDelete(yearToDelete);
    }
  };
  
  const handleOpen = (action: 'copy' | 'delete') => {
    setSelectedAction(action);
    setSourceYear(availableYears[0] || currentYear);
    setTargetYearInput(String(currentYear + 1));
    setYearToDelete(availableYears.length > 0 ? availableYears[0] : null);
    onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Gerenciar Anos de Diretriz
          </DialogTitle>
          <DialogDescription>
            Crie uma nova diretriz copiando uma existente ou exclua uma diretriz antiga.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button 
            variant={selectedAction === 'copy' ? 'default' : 'outline'}
            onClick={() => setSelectedAction('copy')}
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" /> Criar Novo Ano
          </Button>
          <Button 
            variant={selectedAction === 'delete' ? 'destructive' : 'outline'}
            onClick={() => setSelectedAction('delete')}
            disabled={loading || availableYears.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir Ano
          </Button>
        </div>

        {/* --- Ação: Criar Novo Ano --- */}
        {selectedAction === 'copy' && (
          <div className="space-y-4">
            <Alert>
              <Copy className="h-4 w-4" />
              <AlertDescription>
                Crie uma nova diretriz para um ano futuro, copiando todos os valores e itens do ano de origem.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-year">Copiar de (Ano de Origem)</Label>
                <Select
                  value={String(sourceYear)}
                  onValueChange={(val) => setSourceYear(parseInt(val))}
                  disabled={loading || availableYears.length === 0}
                >
                  <SelectTrigger id="source-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target-year">Criar para (Ano de Destino)</Label>
                <Input
                  id="target-year"
                  type="text" // Alterado para 'text' para remover setas e comportamento de setas direcionais
                  inputMode="numeric" // Sugere teclado numérico em dispositivos móveis
                  pattern="[0-9]*" // Sugere apenas dígitos
                  value={targetYearInput}
                  onChange={(e) => {
                    // Filtra a entrada para aceitar apenas dígitos
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setTargetYearInput(value);
                  }}
                  placeholder={String(nextYear)}
                  disabled={loading}
                />
              </div>
            </div>
            
            {!isTargetYearValid && targetYearInput.length > 0 && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                O ano de destino deve ser futuro e não pode já existir.
              </p>
            )}
          </div>
        )}

        {/* --- Ação: Excluir Ano --- */}
        {selectedAction === 'delete' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                A exclusão é permanente e removerá **todas** as configurações (valores, itens Classe II e III) para o ano selecionado.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="year-to-delete">Ano a Excluir</Label>
              <Select
                value={String(yearToDelete)}
                onValueChange={(val) => setYearToDelete(parseInt(val))}
                disabled={loading || availableYears.length === 0}
              >
                <SelectTrigger id="year-to-delete">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem 
                      key={year} 
                      value={String(year)}
                      disabled={year === currentYear} // Não permite excluir o ano atual
                    >
                      {year} {year === currentYear && "(Ano Atual - Não pode ser excluído)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {yearToDelete === currentYear && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Não é possível excluir a diretriz do ano atual.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {selectedAction === 'copy' && (
            <Button 
              onClick={handleCopy} 
              disabled={loading || !isTargetYearValid || availableYears.length === 0}
            >
              {loading ? "Copiando..." : "Criar Diretriz"}
            </Button>
          )}
          {selectedAction === 'delete' && (
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={loading || !yearToDelete || yearToDelete === currentYear}
            >
              {loading ? "Excluindo..." : "Excluir Diretriz"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};