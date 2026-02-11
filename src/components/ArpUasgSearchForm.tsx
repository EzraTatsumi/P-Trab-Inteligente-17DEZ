import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, AlertCircle, CheckCircle, Building2, List, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { fetchArpsByUasg, fetchArpItemsById } from "@/integrations/supabase/api";
import { ArpItemResult, DetailedArpItem } from "@/types/pncp";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ArpUasgSearchFormProps {
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onClose: () => void;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({
    onImport,
    existingItemsInDiretriz,
    onClose,
}) => {
    const [uasg, setUasg] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [arps, setArps] = useState<ArpItemResult[]>([]);
    const [selectedArp, setSelectedArp] = useState<ArpItemResult | null>(null);
    const [arpItems, setArpItems] = useState<DetailedArpItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearchArps = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUasg = uasg.replace(/\D/g, '');
        
        if (cleanUasg.length !== 6) {
            toast.error("A UASG deve ter exatamente 6 dígitos.");
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSelectedArp(null);
        setArpItems([]);
        
        try {
            const data = await fetchArpsByUasg({
                codigoUnidadeGerenciadora: cleanUasg,
                dataVigenciaInicio: new Date().toISOString().split('T')[0], // Vigentes hoje
            });
            setArps(data);
        } catch (error: any) {
            console.error("Erro na busca de ARPs por UASG:", error);
            toast.error(error.message || "Falha ao consultar o PNCP.");
        } finally {
            setLoading(false);
        }
    };

    const handleViewItems = async (arp: ArpItemResult) => {
        setLoadingItems(true);
        setSelectedArp(arp);
        try {
            const items = await fetchArpItemsById(arp.numeroControlePncpAta);
            setArpItems(items);
        } catch (error: any) {
            console.error("Erro ao buscar itens da ARP:", error);
            toast.error("Falha ao carregar itens desta ata.");
            setSelectedArp(null);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleImportItem = (item: DetailedArpItem) => {
        const newItem: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: item.descricaoItem,
            descricao_reduzida: "", 
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

        onImport([newItem]);
        toast.success("Item importado com sucesso!");
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearchArps} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                <div className="md:col-span-3 space-y-2">
                    <Label htmlFor="uasg-input">Código UASG do Órgão</Label>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="uasg-input"
                            placeholder="Ex: 160001 (6 dígitos)"
                            value={uasg}
                            onChange={(e) => setUasg(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            className="pl-10"
                        />
                    </div>
                </div>
                <Button type="submit" disabled={loading || uasg.length !== 6} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar Atas
                </Button>
            </form>

            {hasSearched && !selectedArp && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Atas de Registro de Preços Encontradas ({arps.length})</h3>
                    {arps.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Nenhuma ARP vigente encontrada para esta UASG.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px] border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead>Objeto / Ata</TableHead>
                                        <TableHead className="text-center">Pregão</TableHead>
                                        <TableHead className="text-center">Vigência</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {arps.map((arp) => (
                                        <TableRow key={arp.id}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium leading-tight line-clamp-2">{arp.objeto}</p>
                                                    <Badge variant="outline" className="text-[10px]">Ata: {arp.numeroAta}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs font-semibold">
                                                {arp.pregaoFormatado}
                                            </TableCell>
                                            <TableCell className="text-center text-[10px]">
                                                Até {new Date(arp.dataVigenciaFinal).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => handleViewItems(arp)}
                                                    className="h-8"
                                                >
                                                    Ver Itens
                                                    <ArrowRight className="ml-2 h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>
            )}

            {selectedArp && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-primary/5 p-3 rounded-md border border-primary/20">
                        <div>
                            <h3 className="font-bold text-primary">Itens da Ata: {selectedArp.numeroAta}</h3>
                            <p className="text-xs text-muted-foreground">{selectedArp.pregaoFormatado} - {selectedArp.omNome}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedArp(null)}>
                            Voltar para lista
                        </Button>
                    </div>

                    {loadingItems ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-muted-foreground">Carregando itens da ata...</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px] border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[50%]">Descrição do Item</TableHead>
                                        <TableHead className="text-center">CATMAT/SER</TableHead>
                                        <TableHead className="text-right">Valor Unitário</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {arpItems.map((item) => {
                                        const isAlreadyInDiretriz = existingItemsInDiretriz.some(
                                            ei => ei.codigo_catmat === item.codigoItem && 
                                                  ei.uasg === item.uasg && 
                                                  ei.numero_pregao === item.pregaoFormatado
                                        );

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="text-xs leading-tight">
                                                    {item.descricaoItem}
                                                </TableCell>
                                                <TableCell className="text-center text-xs">
                                                    {item.codigoItem}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-primary">
                                                    {formatCurrency(item.valorUnitario)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isAlreadyInDiretriz ? (
                                                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Adicionado
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

export default ArpUasgSearchForm;