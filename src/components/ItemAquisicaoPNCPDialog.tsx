import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, AlertCircle, Check, XCircle, Package, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchArpItemsByCatmat, fetchCatmatShortDescription, saveNewCatmatEntry } from '@/integrations/supabase/api';
import { DetailedArpItem } from '@/types/pncp';
import { formatCurrency, formatDate, formatPregao } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ItemAquisicaoTemplate } from '@/types/diretrizesMaterialConsumo'; // Importar ItemAquisicaoTemplate
import PriceSearchForm, { SelectedPriceItem } from './pncp/PriceSearchForm';

// Tipo para o item de ARP selecionado
export interface SelectedArpItem extends ItemAquisicaoTemplate {
    // Campos adicionais para rastreamento de ARP
    numeroControlePncpAta: string;
    numeroItem: string;
}

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Callback para retornar o item selecionado (ARP ou Ref. Preço)
    onSelect: (item: SelectedArpItem | SelectedPriceItem) => void;
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({ onOpenChange, open, onSelect }) => {
    const queryClient = useQueryClient();
    const [codigoItem, setCodigoItem] = useState('');
    const [searchDates, setSearchDates] = useState({ dataVigenciaInicialMin: '2023-01-01', dataVigenciaInicialMax: '2024-12-31' });
    const [selectedItem, setSelectedItem] = useState<SelectedArpItem | SelectedPriceItem | null>(null);
    const [catmatDetails, setCatmatDetails] = useState<{ shortDescription: string | null, isCataloged: boolean }>({ shortDescription: null, isCataloged: false });
    const [isCatmatLoading, setIsCatmatLoading] = useState(false);
    const [isSavingCatmat, setIsSavingCatmat] = useState(false);
    const [tab, setTab] = useState<'arp' | 'price'>('arp');

    // Query para buscar itens de ARP
    const { data: arpItems, isLoading: isLoadingArp, isError: isErrorArp, error: errorArp, refetch: refetchArp } = useQuery<DetailedArpItem[]>({
        queryKey: ['arpItemsByCatmat', codigoItem, searchDates],
        queryFn: () => fetchArpItemsByCatmat({ codigoItem: codigoItem.replace(/\D/g, ''), ...searchDates }),
        enabled: false, // Desabilitado por padrão
        retry: 1,
    });
    
    // Efeito para buscar a descrição reduzida do CATMAT
    useEffect(() => {
        const fetchDetails = async () => {
            const code = codigoItem.replace(/\D/g, '');
            if (code.length !== 9) {
                setCatmatDetails({ shortDescription: null, isCataloged: false });
                return;
            }
            
            setIsCatmatLoading(true);
            try {
                const details = await fetchCatmatShortDescription(code);
                setCatmatDetails(details);
            } catch (e) {
                console.error("Erro ao buscar detalhes do CATMAT:", e);
                setCatmatDetails({ shortDescription: null, isCataloged: false });
            } finally {
                setIsCatmatLoading(false);
            }
        };
        
        fetchDetails();
    }, [codigoItem]);

    const handleSearchArp = (e: React.FormEvent) => {
        e.preventDefault();
        if (codigoItem.replace(/\D/g, '').length !== 9) {
            toast.error("O Código CATMAT/CATSER deve ter 9 dígitos.");
            return;
        }
        setSelectedItem(null);
        refetchArp();
    };
    
    const handleSelectArpItem = (item: DetailedArpItem) => {
        // Verifica se a descrição reduzida está disponível
        if (!catmatDetails.shortDescription) {
            toast.error("A descrição reduzida do CATMAT é obrigatória. Por favor, preencha e salve no catálogo.");
            return;
        }
        
        const selected: SelectedArpItem = {
            id: crypto.randomUUID(),
            codigo_catmat: item.codigoItem,
            descricao_item: item.descricaoItem,
            descricao_reduzida: catmatDetails.shortDescription, // Usa a descrição reduzida do catálogo
            valor_unitario: item.valorUnitario,
            numero_pregao: item.pregaoFormatado,
            uasg: item.uasg,
            numeroControlePncpAta: item.numeroControlePncpAta,
            numeroItem: item.id.split('-').pop() || '',
            nd: '33.90.30', // ND padrão para ARP (pode ser ajustado se necessário)
        };
        
        setSelectedItem(selected);
    };
    
    const handleSelectPriceItem = (item: SelectedPriceItem) => {
        setSelectedItem(item);
    };

    const handleConfirmSelection = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            onOpenChange(false);
        }
    };
    
    const handleSaveCatmat = async () => {
        if (!codigoItem.trim() || !catmatDetails.shortDescription) {
            toast.error("Preencha o código CATMAT e a descrição reduzida.");
            return;
        }
        
        setIsSavingCatmat(true);
        try {
            // Busca a descrição completa (se não tiver)
            let fullDescription = '';
            if (arpItems && arpItems.length > 0) {
                fullDescription = arpItems[0].descricaoItem;
            } else {
                // Se não houver ARP, precisamos de uma descrição completa de fallback
                fullDescription = catmatDetails.shortDescription; 
            }
            
            await saveNewCatmatEntry(
                codigoItem, 
                fullDescription, 
                catmatDetails.shortDescription
            );
            
            toast.success("Descrição reduzida salva no catálogo!");
            queryClient.invalidateQueries({ queryKey: ['catmatShortDescription', codigoItem] });
            
        } catch (error) {
            toast.error("Falha ao salvar descrição reduzida.");
            console.error(error);
        } finally {
            setIsSavingCatmat(false);
        }
    };

    const isArpSearchDisabled = isLoadingArp || isCatmatLoading || isSavingCatmat;
    const isPriceSearchDisabled = isLoadingArp || isCatmatLoading || isSavingCatmat;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar Item de Aquisição (PNCP)</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    {/* CATMAT Input e Status */}
                    <div className="grid grid-cols-3 gap-4 border-b pb-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="codigoItem">Código CATMAT/CATSER (9 dígitos) *</Label>
                            <Input
                                id="codigoItem"
                                value={codigoItem}
                                onChange={(e) => setCodigoItem(e.target.value)}
                                placeholder="Ex: 301000000"
                                maxLength={9}
                                required
                                disabled={isArpSearchDisabled}
                            />
                        </div>
                        <div className="space-y-2 col-span-1">
                            <Label htmlFor="shortDescription">Descrição Reduzida (Catálogo)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="shortDescription"
                                    value={catmatDetails.shortDescription || ''}
                                    onChange={(e) => setCatmatDetails(prev => ({ ...prev, shortDescription: e.target.value }))}
                                    placeholder="Preencha para catalogar"
                                    disabled={isArpSearchDisabled || isCatmatLoading}
                                />
                                <Button 
                                    type="button" 
                                    size="icon" 
                                    onClick={handleSaveCatmat}
                                    disabled={isSavingCatmat || !codigoItem.trim() || !catmatDetails.shortDescription}
                                >
                                    {isSavingCatmat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                            </div>
                            {isCatmatLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                    </div>
                    
                    {/* Tabs de Busca */}
                    <div className="flex justify-center">
                        <div className="flex space-x-1 rounded-xl bg-muted p-1">
                            <Button 
                                type="button" 
                                onClick={() => setTab('arp')} 
                                variant={tab === 'arp' ? 'default' : 'ghost'}
                                className="flex-1"
                            >
                                <FileText className="mr-2 h-4 w-4" />
                                Atas de Registro de Preço (ARP)
                            </Button>
                            <Button 
                                type="button" 
                                onClick={() => setTab('price')} 
                                variant={tab === 'price' ? 'default' : 'ghost'}
                                className="flex-1"
                            >
                                <Search className="mr-2 h-4 w-4" />
                                Referência de Preço (Estatísticas)
                            </Button>
                        </div>
                    </div>
                    
                    {/* Conteúdo da Tab ARP */}
                    {tab === 'arp' && (
                        <div className="space-y-4">
                            <form onSubmit={handleSearchArp} className="flex gap-4">
                                <Input
                                    type="date"
                                    value={searchDates.dataVigenciaInicialMin}
                                    onChange={(e) => setSearchDates(prev => ({ ...prev, dataVigenciaInicialMin: e.target.value }))}
                                    disabled={isArpSearchDisabled}
                                />
                                <Input
                                    type="date"
                                    value={searchDates.dataVigenciaInicialMax}
                                    onChange={(e) => setSearchDates(prev => ({ ...prev, dataVigenciaInicialMax: e.target.value }))}
                                    disabled={isArpSearchDisabled}
                                />
                                <Button type="submit" disabled={isArpSearchDisabled || codigoItem.length !== 9} className="w-full">
                                    {isArpSearchDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Buscar ARPs
                                </Button>
                            </form>
                            
                            {isLoadingArp && (
                                <div className="text-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                    <p className="text-sm text-muted-foreground mt-2">Buscando ARPs...</p>
                                </div>
                            )}
                            
                            {isErrorArp && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Erro na Busca de ARP</AlertTitle>
                                    <AlertDescription>
                                        {errorArp instanceof Error ? errorArp.message : "Falha ao buscar Atas de Registro de Preço."}
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {arpItems && arpItems.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg font-semibold">
                                            {arpItems.length} Itens de ARP Encontrados
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-2 max-h-[30vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Pregão/UASG</TableHead>
                                                    <TableHead>OM Gerenciadora</TableHead>
                                                    <TableHead className="text-right">Valor Unitário</TableHead>
                                                    <TableHead className="text-center">Vigência</TableHead>
                                                    <TableHead className="w-[100px] text-center">Ação</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {arpItems.map(item => (
                                                    <TableRow key={item.id} className={cn(selectedItem?.id === item.id && 'bg-primary/10')}>
                                                        <TableCell>
                                                            <span className="font-medium">{formatPregao(item.pregaoFormatado)}</span>
                                                            <p className="text-xs text-muted-foreground">UASG: {item.uasg}</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.omNome}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-green-600">
                                                            {formatCurrency(item.valorUnitario)}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs">
                                                            {formatDate(item.dataVigenciaInicial)} - {formatDate(item.dataVigenciaFinal)}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button 
                                                                type="button" 
                                                                size="sm" 
                                                                onClick={() => handleSelectArpItem(item)}
                                                                disabled={isArpSearchDisabled}
                                                            >
                                                                {selectedItem?.id === item.id ? <Check className="h-4 w-4" /> : "Selecionar"}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}
                            
                            {arpItems && arpItems.length === 0 && !isLoadingArp && (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Nenhuma ARP Encontrada</AlertTitle>
                                    <AlertDescription>
                                        Nenhuma Ata de Registro de Preço ativa foi encontrada para este CATMAT no período. Tente a busca por Referência de Preço.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                    
                    {/* Conteúdo da Tab Referência de Preço */}
                    {tab === 'price' && (
                        <PriceSearchForm 
                            onSelect={handleSelectPriceItem} 
                            onClose={() => onOpenChange(false)}
                        />
                    )}
                </div>
                
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="outline">
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirmSelection} disabled={!selectedItem}>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Item
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;