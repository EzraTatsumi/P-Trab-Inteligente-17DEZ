"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { sanitizeError } from "@/lib/errorUtils";

interface MemoriaCalculoEditorProps {
  registroId: string;
  tableName: 'diaria_registros' | 'verba_operacional_registros';
  memoriaAutomatica: string;
  memoriaCustomizada: string | null;
  isPTrabEditable: boolean;
  queryKey: string[]; // Ex: ['diariaRegistros', ptrabId]
}

export const MemoriaCalculoEditor: React.FC<MemoriaCalculoEditorProps> = ({
  registroId,
  tableName,
  memoriaAutomatica,
  memoriaCustomizada,
  isPTrabEditable,
  queryKey,
}) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [memoriaEdit, setMemoriaEdit] = useState(memoriaCustomizada || memoriaAutomatica);

  const hasCustomMemoria = !!memoriaCustomizada;
  
  // Atualiza o estado de edição quando as props mudam (e.g., ao mudar de registro)
  React.useEffect(() => {
    setMemoriaEdit(memoriaCustomizada || memoriaAutomatica);
    setIsEditing(false);
  }, [registroId, memoriaAutomatica, memoriaCustomizada]);

  const updateMemoriaMutation = useMutation({
    mutationFn: async (newMemoria: string | null) => {
      const payload: { detalhamento_customizado: string | null } = {
        detalhamento_customizado: newMemoria,
      };
      
      const { error } = await supabase
        .from(tableName)
        .update(payload)
        .eq("id", registroId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Memória de cálculo atualizada!");
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar memória:", error);
      toast.error(sanitizeError(error));
    },
  });

  const handleIniciarEdicao = useCallback(() => {
    setMemoriaEdit(memoriaCustomizada || memoriaAutomatica);
    setIsEditing(true);
  }, [memoriaCustomizada, memoriaAutomatica]);

  const handleCancelarEdicao = useCallback(() => {
    setIsEditing(false);
    setMemoriaEdit(memoriaCustomizada || memoriaAutomatica);
  }, [memoriaCustomizada, memoriaAutomatica]);

  const handleSalvarMemoriaCustomizada = useCallback(() => {
    updateMemoriaMutation.mutate(memoriaEdit.trim() || null);
  }, [memoriaEdit, updateMemoriaMutation]);

  const handleRestaurarMemoriaAutomatica = useCallback(() => {
    if (!confirm("Deseja realmente restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
        return;
    }
    updateMemoriaMutation.mutate(null);
  }, [updateMemoriaMutation]);

  const memoriaExibida = isEditing ? memoriaEdit : (memoriaCustomizada || memoriaAutomatica);
  const isSaving = updateMemoriaMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-foreground">
              Memória de Cálculo
            </h4>
            {hasCustomMemoria && !isEditing && (
              <Badge variant="outline" className="text-xs">
                Editada manualmente
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 shrink-0">
          {!isEditing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleIniciarEdicao}
                disabled={isSaving || !isPTrabEditable}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Editar Memória
              </Button>
              
              {hasCustomMemoria && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRestaurarMemoriaAutomatica}
                  disabled={isSaving || !isPTrabEditable}
                  className="gap-2 text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restaurar Automática
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleSalvarMemoriaCustomizada}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancelarEdicao}
                disabled={isSaving}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>
      
      <Card className="p-4 bg-background rounded-lg border">
        {isEditing ? (
          <Textarea
            value={memoriaEdit}
            onChange={(e) => setMemoriaEdit(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Digite a memória de cálculo..."
          />
        ) : (
          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
            {memoriaExibida}
          </pre>
        )}
      </Card>
    </div>
  );
};