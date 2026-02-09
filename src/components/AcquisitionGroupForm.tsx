import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Save, X, Package, FileText, Loader2 } from "lucide-react";
import { AcquisitionGroup } from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency } from "@/lib/formatUtils";
import { toast } from "sonner";

interface AcquisitionGroupFormProps {
    initialGroup?: AcquisitionGroup;
    onSave: (group: AcquisitionGroup) => void;
    onCancel: () => void;
    isSaving: boolean;
    // Propriedade para simular a importação (próximo passo)
    onOpenImport: (groupId: string) => void; 
}

const AcquisitionGroupForm: React.FC<AcquisitionGroupFormProps> = ({ 
    initialGroup, 
    onSave, 
    onCancel, 
    isSaving,
    onOpenImport,
}) => {
    const [groupName, setGroupName] = useState(initialGroup?.groupName || '');
    const [groupPurpose, setGroupPurpose] = useState(initialGroup?.groupPurpose || '');
    const [items, setItems] = useState<ItemAquisicao[]>(initialGroup?.items || []);
    const [tempId] = useState(initialGroup?.tempId || crypto.randomUUID());
    
    // Placeholder para cálculo (será substituído por calculateGroupTotals)
    const totalValue = items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim()) {
            toast.error("O Nome do Grupo de Aquisição é obrigatório.");
            return;
        }
        
        // Nota: totalND30 e totalND39 serão calculados no MaterialConsumoForm.tsx antes de salvar no DB.
        // Aqui, apenas passamos o totalValue e os itens.
        onSave({
            tempId,
            groupName: groupName.trim(),
            groupPurpose: groupPurpose.trim() || null,
            items,
            totalValue,
            totalND30: 0, // Placeholder
            totalND39: 0, // Placeholder
        } as AcquisitionGroup);
    };
    
    // Placeholder para simular a importação (próximo passo)
    const handleSimulateImport = () => {
        // Simulação de importação de 2 itens
        const simulatedItems: ItemAquisicao[] = [
            {
                id: crypto.randomUUID(),
                codigo_catmat: '123456789',
                descricao_item: 'Caneta Esferográfica Azul',
                valor_unitario: 1.50,
                quantidade: 100,
                valor_total: 150.00,
                nd: '33.90.30',
                numero_pregao: '001/24',
                uasg: '123456',
                om_detentora: 'CMDO 1ª RM',
                ug_detentora: '123456',
            },
            {
                id: crypto.randomUUID(),
                codigo_catmat: '987654321',
                descricao_item: 'Papel A4 Branco',
                valor_unitario: 25.00,
                quantidade: 50,
                valor_total: 1250.00,
                nd: '33.90.30',
                numero_pregao: '002/24',
                uasg: '654321',
                om_detentora: 'CMDO 1ª RM',
                ug_detentora: '123456',
            }
        ];
        setItems(simulatedItems);
        toast.info("Itens de aquisição simulados adicionados ao grupo.");
    };
    
    const displayTitle = groupName.trim() || (initialGroup ? 'Editando Grupo' : 'Novo Grupo');

    return (
        <Card className="border border-gray-300 bg-background p-4 shadow-lg">
            <h4 className="font-bold text-lg mb-4">{displayTitle}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="groupName">Nome do Grupo *</Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Ex: Material de Escritório - QG"
                            required
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="groupPurpose">Finalidade (Opcional)</Label>
                        <Input
                            id="groupPurpose"
                            value={groupPurpose}
                            onChange={(e) => setGroupPurpose(e.target.value)}
                            placeholder="Ex: Apoio à Seção de Logística"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="items">Itens de Subitens da ND ({items.length} itens)</Label>
                    <Card className="p-3 bg-background">
                        {items.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">
                                Nenhum item importado.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center text-sm border-b pb-1 last:border-b-0">
                                        <span className="truncate font-medium">
                                            {item.descricao_item}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                            {formatCurrency(item.valor_total)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-3 border-t mt-3">
                            <span className="font-bold">Total do Grupo:</span>
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(totalValue)}
                            </span>
                        </div>
                    </Card>
                </div>

                <div className="flex justify-between gap-3 pt-2">
                    <Button 
                        type="button" 
                        variant="default" 
                        onClick={handleSimulateImport} // Usando a simulação por enquanto
                        disabled={isSaving}
                        className="flex-1 bg-teal-700 hover:bg-teal-800 text-white"
                    >
                        <Package className="mr-2 h-4 w-4" />
                        Importar/Alterar Itens de Subitens da ND ({items.length} itens)
                    </Button>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                    <Button 
                        type="submit" 
                        disabled={isSaving || !groupName.trim()}
                        className="w-auto bg-gray-500 hover:bg-gray-600 text-white"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Grupo
                    </Button>
                    
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onCancel}
                        disabled={isSaving}
                        className="w-auto"
                    >
                        Cancelar
                    </Button>
                </div>
            </form>
        </Card>
    );
};

export default AcquisitionGroupForm;