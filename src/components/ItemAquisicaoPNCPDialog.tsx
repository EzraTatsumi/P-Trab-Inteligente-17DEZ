import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: any[]) => void;
    existingItemsInDiretriz: any[];
    onReviewItem?: (item: any) => void;
    selectedYear: number;
    mode: 'material' | 'servico';
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem,
    selectedYear,
    mode
}) => {
    const [uasg, setUasg] = useState('');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async () => {
        if (!uasg || uasg.length !== 6) {
            toast.error("Informe uma UASG válida com 6 dígitos.");
            return;
        }

        setSearching(true);
        try {
            // Simulação da chamada API PNCP (ajuste para sua implementação real de fetch)
            // Aqui estamos focando na lógica de inspeção de catálogo solicitada
            const response = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${uasg}/compras/ultimas?pagina=1&tamanhoPagina=10`);
            const data = await response.json();
            
            // Mapeamento simplificado para exemplo
            const mappedItems = (data.data || []).map((item: any) => ({
                id: Math.random().toString(36).substring(2, 9),
                descricao_item: item.descricao || '',
                descricao_reduzida: item.objeto || '',
                unidade_medida: item.unidadeMedida || 'UN',
                valor_unitario: item.valorUnitarioEstimado || 0,
                numero_pregao: item.numeroCompra || '',
                uasg: uasg,
                codigo_catmat: item.codigoItem || '',
                nd: item.naturezaDespesa || '',
            }));

            setItems(mappedItems);
        } catch (error) {
            console.error("Erro ao buscar no PNCP:", error);
            toast.error("Erro ao consultar API do PNCP.");
        } finally {
            setSearching(false);
        }
    };

    const handleImportItem = async (item: any) => {
        setLoading(true);
        try {
            // Lógica de Inspeção de Catálogo baseada no MODE
            const rpcName = mode === 'material' ? 'upsert_catmat_entry' : 'upsert_catser_entry';
            
            const { error: upsertError } = await supabase.rpc(rpcName, {
                p_code: item.codigo_catmat,
                p_description: item.descricao_item,
                p_short_description: item.descricao_reduzida
            });

            if (upsertError) throw upsertError;

            onImport([item]);
            toast.success(`Item importado e catálogo de ${mode === 'material' ? 'materiais' : 'serviços'} atualizado.`);
            
            if (onReviewItem) {
                onReviewItem(item);
            }
        } catch (error) {
            console.error("Erro na importação:", error);
            toast.error("Falha ao processar inspeção de catálogo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importar {mode === 'material' ? 'Materiais' : 'Serviços'} via PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise itens por UASG e importe diretamente para sua diretriz. O sistema atualizará o catálogo de {mode === 'material' ? 'CATMAT' : 'CATSER'} automaticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="uasg-search">UASG do Órgão</Label>
                            <Input 
                                id="uasg-search" 
                                value={uasg} 
                                onChange={(e) => setUasg(e.target.value.replace(/\D/g, ''))}
                                placeholder="Ex: 160001"
                                maxLength={6}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={searching}>
                            {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                            Pesquisar
                        </Button>
                    </div>

                    {items.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="text-center">Código</TableHead>
                                        <TableHead className="text-right">Valor Est.</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs max-w-[300px] truncate">
                                                {item.descricao_item}
                                            </TableCell>
                                            <TableCell className="text-center text-xs">{item.codigo_catmat}</TableCell>
                                            <TableCell className="text-right text-xs font-bold">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => handleImportItem(item)}
                                                    disabled={loading}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : !searching && uasg.length === 6 && (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum item encontrado para esta UASG.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;