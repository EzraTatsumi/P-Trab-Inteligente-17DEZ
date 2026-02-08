import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Package, XCircle } from "lucide-react";
import { MaterialConsumoGrupo } from "@/types/materialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from '@/lib/utils';

interface MaterialConsumoGrupoCardProps {
    grupo: MaterialConsumoGrupo;
    isStagingUpdate: boolean;
    isSaving: boolean;
    onRemovePending: (id: string) => void;
}

const MaterialConsumoGrupoCard: React.FC<MaterialConsumoGrupoCardProps> = ({
    grupo,
    isStagingUpdate,
    isSaving,
    onRemovePending,
}) => {
    
    const isOmDestinoDifferent = grupo.organizacao !== grupo.om_detentora || grupo.ug !== grupo.ug_detentora;
    const totalItens = grupo.itensSelecionados.reduce((sum, item) => sum + item.quantidade, 0);
    
    return (
        <Card 
            key={grupo.id} 
            className={cn(
                "border-2 shadow-md",
                "border-secondary bg-secondary/10"
            )}
        >
            <CardContent className="p-4">
                
                <div className={cn("flex justify-between items-center pb-2 mb-2", "border-b border-secondary/30")}>
                    <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {grupo.nrSubitem} - {grupo.nomeSubitem}
                    </h4>
                    <div className="flex items-center gap-2">
                        <p className="font-extrabold text-lg text-foreground text-right">
                            {formatCurrency(grupo.totalLinha)}
                        </p>
                        {!isStagingUpdate && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => onRemovePending(grupo.id)}
                                disabled={isSaving}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Detalhes da Solicitação */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                    <div className="space-y-1">
                        <p className="font-medium">OM Favorecida:</p>
                        <p className="font-medium">OM Destino do Recurso:</p>
                        <p className="font-medium">Itens de Aquisição:</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="font-medium">{grupo.organizacao} ({formatCodug(grupo.ug)})</p>
                        <p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>
                            {grupo.om_detentora} ({formatCodug(grupo.ug_detentora)})
                        </p>
                        <p className="font-medium">{totalItens} item(ns) | {grupo.itensSelecionados.length} tipo(s)</p>
                    </div>
                </div>
                
                <div className="w-full h-[1px] bg-secondary/30 my-3" />

                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ND 33.90.30:</span>
                    <span className="font-medium text-green-600">{formatCurrency(grupo.valorND30)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ND 33.90.39:</span>
                    <span className="font-medium text-green-600">{formatCurrency(grupo.valorND39)}</span>
                </div>
            </CardContent>
        </Card>
    );
};

export default MaterialConsumoGrupoCard;