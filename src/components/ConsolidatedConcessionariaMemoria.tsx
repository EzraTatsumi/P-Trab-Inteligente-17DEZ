import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { ConsolidatedConcessionariaRecord, generateConsolidatedConcessionariaMemoriaCalculo } from "@/lib/concessionariaUtils";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { useConcessionariaDiretrizDetails } from "@/hooks/useConcessionariaDiretrizDetails";

interface ConsolidatedConcessionariaMemoriaProps {
    group: ConsolidatedConcessionariaRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedConcessionariaRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedConcessionariaMemoria: React.FC<ConsolidatedConcessionariaMemoriaProps> = ({
    group,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica,
}) => {
    const firstRecord = group.records[0];
    const isEditing = editingMemoriaId === firstRecord.id;
    let hasCustomMemoria = !!firstRecord.detalhamento_customizado;
    
    // Usamos o ID do primeiro registro para buscar detalhes da diretriz (embora o grupo possa ter mais de uma)
    // Nota: O detalhamento customizado é salvo APENAS no primeiro registro do grupo.
    const diretrizId = firstRecord.diretriz_id;

    // Busca os detalhes da diretriz (Nome da Concessionária, Fontes)
    // Nota: Este hook só busca os detalhes da PRIMEIRA diretriz do grupo, mas a memória automática usa todos os records.
    const { data: diretrizDetails, isLoading: isLoadingDiretriz } = useConcessionariaDiretrizDetails(diretrizId);

    // 1. Gerar a memória automática consolidada COMPLETA (incluindo Fontes)
    const memoriaAutomaticaCompleta = useMemo(() => {
        if (isLoadingDiretriz) return "Carregando detalhes da diretriz...";
        
        let memoria = generateConsolidatedConcessionariaMemoriaCalculo(group);
        
        // Adicionar Fontes de Referência (buscamos os detalhes de todas as diretrizes no grupo)
        const fontes = group.records.map(r => {
            // Como não podemos usar useQuery dentro de useMemo, usamos os dados que já estão no registro
            // ou assumimos que o primeiro registro (diretrizDetails) é representativo para as fontes.
            // Para simplificar, vamos apenas listar as fontes se o primeiro registro tiver.
            return {
                nome: r.detalhamento?.split(': ')[1] || r.categoria,
                fonteConsumo: diretrizDetails?.fonte_consumo || 'Não informada',
                fonteCusto: diretrizDetails?.fonte_custo || 'Não informada',
            };
        });
        
        if (fontes.length > 0) {
            memoria += `\nFONTES DE REFERÊNCIA:\n`;
            // Filtra fontes duplicadas (se houver)
            const uniqueFontes = Array.from(new Set(fontes.map(f => `${f.nome}|${f.fonteConsumo}|${f.fonteCusto}`)))
                .map(s => {
                    const parts = s.split('|');
                    return { nome: parts[0], fonteConsumo: parts[1], fonteCusto: parts[2] };
                });
                
            uniqueFontes.forEach(f => {
                memoria += `[${f.nome}]\n`;
                memoria += `  Consumo: ${f.fonteConsumo}\n`;
                memoria += `  Custo: ${f.fonteCusto}\n`;
            });
        }
        
        return memoria;
    }, [group, diretrizDetails, isLoadingDiretriz]);

    // 2. Determinar a memória a ser exibida/editada
    let memoriaExibida = memoriaAutomaticaCompleta;
    
    if (isEditing) {
        memoriaExibida = memoriaEdit;
    } else if (hasCustomMemoria) {
        let customMemoria = firstRecord.detalhamento_customizado!;
        
        // Se houver customização, exibimos a customizada.
        memoriaExibida = customMemoria;
    }
    
    // Verifica se a OM Detentora é diferente da OM Favorecida
    const isDifferentOmInMemoria = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;

    // Handler local para iniciar a edição, passando a memória completa
    const handleLocalIniciarEdicao = () => {
        // Se houver customização, passamos APENAS o texto customizado do DB para edição
        // Se não houver customização, passamos a automática completa (com fontes)
        const memoriaParaEdicao = hasCustomMemoria 
            ? firstRecord.detalhamento_customizado! 
            : memoriaAutomaticaCompleta; 
            
        handleIniciarEdicaoMemoria(group, memoriaParaEdicao);
    };

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                            {group.organizacao} (UG: {formatCodug(group.ug)})
                        </h4>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                    {isDifferentOmInMemoria && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">
                                Destino Recurso: {group.om_detentora} ({formatCodug(group.ug_detentora)})
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {isLoadingDiretriz ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : !isEditing ? (
                        <>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleLocalIniciarEdicao} 
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
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecord.id)}
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
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecord.id)}
                                disabled={isSaving}
                                className="gap-2"
                            >
                                <Check className="h-4 w-4" />
                                Salvar
                            </Button>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleCancelarEdicaoMemoria}
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
                {isLoadingDiretriz ? (
                    <div className="flex items-center justify-center h-20">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Carregando detalhes da diretriz...</span>
                    </div>
                ) : isEditing ? (
                    <Textarea
                        value={memoriaExibida}
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