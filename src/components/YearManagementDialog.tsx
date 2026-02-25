"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from '@/components/SessionContextProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface YearManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: 'diretrizes_custeio' | 'diretrizes_operacionais';
  currentYears: number[];
  onYearAdded: (year: number) => void;
}

export const YearManagementDialog: React.FC<YearManagementDialogProps> = ({
  open,
  onOpenChange,
  tableName,
  currentYears = [], // Garantimos que inicia como array vazio
  onYearAdded,
}) => {
  const { user } = useSession();
  const [newYear, setNewYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(false);

  const handleAddYear = async () => {
    if (!user?.id) return;
    const year = parseInt(newYear);
    
    if (isNaN(year) || year < 2000 || year > 2100) {
      toast.error("Por favor, insira um ano válido.");
      return;
    }

    if (currentYears?.includes(year)) {
      toast.error("Este ano já possui diretrizes cadastradas.");
      return;
    }

    setIsLoading(true);
    try {
      // Cria uma entrada básica para o novo ano
      const { error } = await supabase
        .from(tableName)
        .insert({
          user_id: user.id,
          ano_referencia: year,
        } as any);

      if (error) throw error;

      toast.success(`Ano ${year} adicionado com sucesso!`);
      onYearAdded(year);
      setNewYear((year + 1).toString());
    } catch (error: any) {
      console.error("Erro ao adicionar ano:", error);
      toast.error("Falha ao criar diretrizes para o novo ano.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteYear = async (year: number) => {
    if (!user?.id) return;
    
    // Verificação de segurança adicional para o erro relatado
    const yearsCount = currentYears?.length || 0;
    if (yearsCount <= 1) {
      toast.error("Não é possível excluir o único ano cadastrado.");
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir TODAS as diretrizes do ano ${year}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', user.id)
        .eq('ano_referencia', year);

      if (error) throw error;

      toast.success(`Diretrizes de ${year} excluídas.`);
      // Recarrega a página para atualizar o estado global dos anos
      window.location.reload();
    } catch (error: any) {
      console.error("Erro ao excluir ano:", error);
      toast.error("Falha ao excluir diretrizes do ano.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Gerenciar Anos de Referência
          </DialogTitle>
          <DialogDescription>
            Adicione novos anos para planejamento ou remova anos obsoletos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-end gap-2">
            <div className="grid gap-2 flex-1">
              <Label htmlFor="new-year">Novo Ano</Label>
              <Input
                id="new-year"
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="Ex: 2026"
                disabled={isLoading}
              />
            </div>
            <Button onClick={handleAddYear} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anos Ativos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentYears && currentYears.length > 0 ? (
                  currentYears.sort((a, b) => b - a).map((year) => (
                    <TableRow key={year}>
                      <TableCell className="font-medium">{year}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteYear(year)}
                          disabled={isLoading || (currentYears?.length || 0) <= 1}
                          title="Excluir este ano"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                      Nenhum ano cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};