import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { ConsolidatedConcessionariaRecord, ConcessionariaRegistroComDiretriz } from "@/lib/concessionariaUtils";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ConcessionariaMemoriaItem } from "./ConcessionariaMemoriaItem"; // Importando o novo componente

interface ConsolidatedConcessionariaMemoriaProps {
    group: ConsolidatedConcessionariaRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    // O handler agora recebe o registro individual
    handleIniciarEdicaoMemoria: (registro: ConcessionariaRegistroComDiretriz, memoriaCompleta: string) => void;
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
    
    // Ordena os registros para garantir que 'Água/Esgoto' venha sempre antes de 'Energia Elétrica'
    const sortedRecords = useMemo(() => {
        const order = { 'Água/Esgoto': 1, 'Energia Elétrica': 2 };
        
        return [...group.records].sort((a, b) => {
            const orderA = order[a.categoria as keyof typeof order] || 99;
            const orderB = order[b.categoria as keyof typeof order] || 99;
            return orderA - orderB;
        });
    }, [group.records]);

    return (
        <div className="space-y-4">
            
            {/* Itera sobre os registros individuais ordenados */}
            <div className="space-y-3">
                {sortedRecords.map(registro => (
                    <ConcessionariaMemoriaItem
                        key={registro.id}
                        registro={registro} // O tipo já está correto aqui
                        isPTrabEditable={isPTrabEditable}
                        isSaving={isSaving}
                        editingMemoriaId={editingMemoriaId}
                        memoriaEdit={memoriaEdit}
                        setMemoriaEdit={setMemoriaEdit}
                        handleIniciarEdicaoMemoria={handleIniciarEdicaoMemoria}
                        handleCancelarEdicaoMemoria={handleCancelarEdicaoMemoria}
                        handleSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada}
                        handleRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica}
                    />
                ))}
            </div>
        </div>
    );
};