import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Check, AlertCircle, Ruler } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ServicoUnitMeasureDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: ItemAquisicao[];
    onConfirm: (items: ItemAquisicao[]) => void;
}

const ServicoUnitMeasureDialog: React.FC<ServicoUnitMeasureDialogProps> = ({
    open,
    onOpenChange,
    items,
    onConfirm,
}) => {
    const [localItems, setLocalItems] = useState<ItemAquisicao[]>([]);

    useEffect(() => {
        if (open) {
            // Inicializa com string vazia para forçar o preenchimento manual
            setLocalItems(items.map(item => ({
                ...item,
                unidade_medida: (item as any).unidade_medida || ''
            })));
        }
    }, [open, items]);

    const handleUnitChange = (id: string, value: string) => {
        setLocalItems(prev => prev.map(item => 
            item.id === id ? { ...item, unidade_medida: value } : item
        ));
    };

    const handleConfirm = () => {
        onConfirm(localItems);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ruler className="h-5 w-5 text-primary" />
                        Definir Unidades de Medida
                    </DialogTitle>
                    <DialogDescription>
                        Para itens de serviço, é necessário informar a unidade de medida (ex: hora, dia, mês, ano).
                    </DialogDescription>
                </DialogHeader>

                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Ajuste Necessário</AlertTitle>
                    <AlertDescription className="text-blue-700">
                        Verifique e ajuste a unidade de medida para cada item de serviço importado abaixo antes de finalizar.
                    </AlertDescription>
                </Alert>

                <div className="mt-4 border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Item de Serviço</TableHead>
                                <TableHead className="w-[220px] text-center">Unidade de Medida</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-xs">
                                        <p className="font-semibold">{item.descricao_reduzida || item.descricao_item}</p>
                                        <p className="text-muted-foreground">Cód. CATSER: {item.codigo_catmat}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={(item as any).unidade_medida} 
                                            onChange={(e) => handleUnitChange(item.id, e.target.value.toUpperCase())}
                                            placeholder="Ex: hora/dia/mês/ano"
                                            className="h-9 text-center"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="mt-6">
                    <Button onClick={handleConfirm} className="w-full md:w-auto">
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar e Finalizar Importação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ServicoUnitMeasureDialog;