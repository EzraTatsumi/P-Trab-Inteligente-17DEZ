import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, AlertCircle, CheckCircle, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fetchArpItemsByCatmat } from "@/integrations/supabase/api";
import { DetailedArpItem } from "@/types/pncp";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ArpCatmatSearchFormProps {
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onClose: () => void;
    onReviewItem?: (item: ItemAquisicao) => void;
    selectedYear: number;
}

const ArpCatmatSearchForm: React.FC<ArpCatmatSearchFormProps> = ({
    onImport,
    existingItemsInDiretriz,
    onClose,
    onReviewItem,
    selectedYear,
}) => {
    const [codigoCatmat, setCodigoCatmat] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<DetailedArpItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = codigoCatmat.replace(/\D/g, '');
        
        if (!cleanCode) {
            toast.error("Informe um código CATMAT/CATSER válido.");
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            // Busca itens com vigência no ano atual (simplificado)
            const data = await fetchArpItemsByCatmat({
                codigoItem: cleanCode,
                dataVigenciaInicialMin: `${selectedYear}-01-01`,
                dataVigenciaInicialMax: `${selectedYear}-12-31`,
            });
            setResults(data);
        } catch (error: any) {
            console.error("Erro na busca por CATMAT/CATSER:", error);
            toast.error(error.message || "Falha ao consultar o PNCP.");
        } finally {
            setLoading(false);
        }
    };

    const handleImportItem = (item: DetailedArpItem) => {
        const newItem: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: item.descricaoItem,
            descricao_reduzida: "", // Será preenchido no review ou manualmente
            valor_unitario: item.valorUnitario,
            numero_pregao: item.pregaoFormatado,
            uasg: item.uasg,
            codigo_catmat: item.codigoItem,
            quantidade: 0,
            valor_total: 0,
            nd: "",
            nr_subitem: "",
            nome_subitem: "",
        };

        if (onReviewItem) {
            onReviewItem(newItem);
            onClose();
        } else {
            onImport([newItem]);
            toast.success("Item importado com sucesso!");
        }
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="catmat-input">Código CATMAT/CATSER</Label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="catmat-input"
                            placeholder="Ex: 123456 (Apenas números)"
                            value={codigoCatmat}
                            onChange={(e) => setCodigoCatmat(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Dica: Use o catálogo de CATMAT/CATSER do sistema para encontrar o código correto antes de pesquisar aqui.
                    </p>
                </div>
                <Button type="submit" disabled={loading || !codigoCatmat} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Pesquisar no PNCP
                </Button>
            </form>

            {hasSearched && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Resultados Encontrados ({results.length})</h3>
                        {results.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                                Vigência em {selectedYear}
                            </Badge>
                        )}
                    </div>

                    {results.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Nenhum item encontrado para este código CATMAT/CATSER com vigência em {selectedYear}.</p>
                            <p className="text-xs text-muted-foreground mt-1">Tente outro código ou verifique se o item possui Atas de Registro de Preços ativas.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px] border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Descrição do Item / Órgão</TableHead>
                                        <TableHead className="text-center">Pregão / UASG</TableHead>
                                        <TableHead className="text-right">Valor Unitário</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((item) => {
                                        const isAlreadyInDiretriz = existingItemsInDiretriz.some(
                                            ei => ei.codigo_catmat === item.codigoItem && 
                                                  ei.uasg === item.uasg && 
                                                  ei.numero_pregao === item.pregaoFormatado
                                        );

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-medium leading-tight line-clamp-2">{item.descricaoItem}</p>
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <Building2 className="h-3 w-3" />
                                                            <span className="truncate max-w-[200px]">{item.omNome}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="text-xs font-semibold">{item.pregaoFormatado}</div>
                                                    <div className="text-[10px] text-muted-foreground">UASG: {formatCodug(item.uasg)}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-primary">
                                                    {formatCurrency(item.valorUnitario)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isAlreadyInDiretriz ? (
                                                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Já Adicionado
                                                        </Badge>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            onClick={() => handleImportItem(item)}
                                                            className="h-8"
                                                        >
                                                            Importar
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArpCatmatSearchForm;