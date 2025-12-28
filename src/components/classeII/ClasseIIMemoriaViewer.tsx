import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, XCircle, Check, Sparkles, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCodug, formatCurrency } from "@/lib/formatUtils";
import { getCategoryBadgeStyle, getCategoryLabel } from "@/lib/badgeUtils";
import { generateClasseIIMemoriaCalculo } from "@/lib/classeIIUtils";

type Categoria = "Equipamento Individual" | "Proteção Balística" | "Material de Estacionamento";

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

interface ClasseIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  om_detentora: string; // OM Detentora (Source)
  ug_detentora: string; // UG Detentora (Source)
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[];
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
  efetivo: number;
}

interface ClasseIIMemoriaViewerProps {
  registros: ClasseIIRegistro[];
  loading: boolean;
  onSalvarMemoriaCustomizada: (registroId: string, memoria: string) => Promise<void>;
  onRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ClasseIIMemoriaViewer: React.FC<ClasseIIMemoriaViewerProps> = ({
  registros,
  loading,
  onSalvarMemoriaCustomizada,
  onRestaurarMemoriaAutomatica,
}) => {
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");

  const handleIniciarEdicaoMemoria = useCallback((registro: ClasseIIRegistro) => {
    setEditingMemoriaId(registro.id);
    
    const omDetentora = registro.om_detentora || registro.organizacao;
    const ugDetentora = registro.ug_detentora || registro.ug;
    
    const memoriaAutomatica = generateClasseIIMemoriaCalculo(
        registro.categoria as Categoria, 
        registro.itens_equipamentos as ItemClasseII[], 
        registro.dias_operacao, 
        omDetentora, 
        ugDetentora, 
        registro.fase_atividade,
        registro.efetivo, 
        registro.valor_nd_30, 
        registro.valor_nd_39 
    );
    
    setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
  }, []);

  const handleCancelarEdicaoMemoria = useCallback(() => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  }, []);

  const handleSalvar = useCallback(async (registroId: string) => {
    await onSalvarMemoriaCustomizada(registroId, memoriaEdit);
    handleCancelarEdicaoMemoria();
  }, [memoriaEdit, onSalvarMemoriaCustomizada, handleCancelarEdicaoMemoria]);

  return (
    <div className="space-y-4 mt-8">
      <h3 className="text-xl font-bold flex items-center gap-2">
        📋 Memórias de Cálculos Detalhadas
      </h3>
      
      {registros.map(registro => {
        const omDetentora = registro.om_detentora;
        const ugDetentora = registro.ug_detentora;
        const isEditing = editingMemoriaId === registro.id;
        const hasCustomMemoria = !!registro.detalhamento_customizado;
        
        const isDifferentOm = omDetentora !== registro.organizacao;
        
        const memoriaAutomatica = generateClasseIIMemoriaCalculo(
            registro.categoria as Categoria, 
            registro.itens_equipamentos as ItemClasseII[], 
            registro.dias_operacao, 
            omDetentora, 
            ugDetentora, 
            registro.fase_atividade,
            registro.efetivo, 
            registro.valor_nd_30, 
            registro.valor_nd_39 
        );
        
        const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
        const badgeStyle = getCategoryBadgeStyle(registro.categoria);

        return (
          <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                          OM Detentora: {omDetentora} (UG: {formatCodug(ugDetentora)})
                        </h4>
                        <Badge variant="default" className={cn("w-fit", badgeStyle.className)}>
                            {badgeStyle.label}
                        </Badge>
                        {hasCustomMemoria && !isEditing && (
                          <Badge variant="outline" className="text-xs">
                            Editada manualmente
                          </Badge>
                        )}
                    </div>
                    
                    {isDifferentOm && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">
                                Recurso destinado à OM: {registro.organizacao} ({formatCodug(registro.ug)})
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleIniciarEdicaoMemoria(registro)}
                          disabled={loading}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar Memória
                        </Button>
                        
                        {hasCustomMemoria && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRestaurarMemoriaAutomatica(registro.id)}
                            disabled={loading}
                            className="gap-2 text-muted-foreground"
                          >
                            <XCircle className="h-4 w-4" />
                            Restaurar Automática
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSalvar(registro.id)}
                          disabled={loading}
                          className="gap-2"
                        >
                          <Check className="h-4 w-4" />
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelarEdicaoMemoria}
                          disabled={loading}
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
      })}
    </div>
  );
};