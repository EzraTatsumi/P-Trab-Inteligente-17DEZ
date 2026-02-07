import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ArpUasgSearchForm from './ArpUasgSearchForm';
import ArpUasgResults from './ArpUasgResults';
import { ArpUasgSearchParams, ArpItemResult } from '@/types/pncp';
import { useQuery } from '@tanstack/react-query';
import { fetchArpsByUasg } from '@/integrations/supabase/api';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

// Estados de visualização
type ViewState = 'search' | 'results' | 'details';

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [view, setView] = useState<ViewState>('search');
    const [searchParams, setSearchParams] = useState<ArpUasgSearchParams | null>(null);
    const [selectedArp, setSelectedArp] = useState<ArpItemResult | null>(null);
    
    // Query para buscar ARPs por UASG
    const { data: arpResults, isLoading: isSearching, error: searchError } = useQuery({
        queryKey: ['arpUasgSearch', searchParams],
        queryFn: () => fetchArpsByUasg(searchParams!),
        enabled: view === 'results' && !!searchParams,
        initialData: [],
    });
    
    // Efeito para lidar com erros de busca
    if (searchError) {
        toast.error(searchError.message || "Erro desconhecido na busca de ARPs.");
        // Resetar para a view de busca em caso de erro
        setView('search');
    }

    const handleSearch = (params: ArpUasgSearchParams) => {
        setSearchParams(params);
        setView('results');
    };
    
    const handleSelectArp = (arp: ArpItemResult) => {
        setSelectedArp(arp);
        setView('details');
    };
    
    const handleImportItems = (items: ItemAquisicao[]) => {
        onImport(items);
        // Fecha o diálogo principal após a importação
        onOpenChange(false); 
    };
    
    const handleBack = () => {
        if (view === 'details') {
            setView('results');
            setSelectedArp(null);
        } else if (view === 'results') {
            setView('search');
            setSearchParams(null);
        }
    };
    
    const title = useMemo(() => {
        switch (view) {
            case 'search':
                return "Buscar ARPs por UASG";
            case 'results':
                return "Resultados da Busca de ARPs";
            case 'details':
                return `Detalhes da ARP: ${selectedArp?.numeroAta || 'Carregando...'}`;
            default:
                return "Consulta PNCP";
        }
    }, [view, selectedArp]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {view === 'search' && "Consulte Atas de Registro de Preços (ARPs) no PNCP por Unidade Gestora e período de vigência."}
                        {view === 'results' && "Selecione uma ARP para visualizar os itens detalhados."}
                        {view === 'details' && `Itens detalhados da ARP ${selectedArp?.numeroAta}. Selecione os itens para importar.`}
                    </DialogDescription>
                </DialogHeader>
                
                {view !== 'search' && (
                    <Button variant="ghost" onClick={handleBack} className="w-fit">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                )}

                <CardContent className="p-0">
                    {view === 'search' && (
                        <ArpUasgSearchForm 
                            onSearch={handleSearch}
                            isSearching={isSearching}
                        />
                    )}
                    
                    {view === 'results' && isSearching && (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Buscando ARPs...</p>
                        </div>
                    )}
                    
                    {view === 'results' && !isSearching && arpResults && (
                        <ArpUasgResults 
                            results={arpResults}
                            onSelectArp={handleSelectArp}
                        />
                    )}
                    
                    {view === 'details' && selectedArp && (
                        // TODO: Criar componente ArpItemDetails para exibir e selecionar itens
                        <Card className="mt-4 p-6 text-center">
                            <p className="text-lg font-semibold">Visualização de Detalhes da ARP</p>
                            <p className="text-muted-foreground">
                                Implementação pendente: Aqui será exibida a lista de itens da ARP {selectedArp.numeroAta} para seleção e importação.
                            </p>
                            <Button 
                                onClick={() => handleImportItems([{ 
                                    id: Math.random().toString(36).substring(2, 9),
                                    descricao_item: `Item de Teste da ARP ${selectedArp.numeroAta}`,
                                    descricao_reduzida: `Teste ARP`,
                                    valor_unitario: 100.00,
                                    numero_pregao: selectedArp.numeroAta,
                                    uasg: selectedArp.uasg,
                                    codigo_catmat: '000000000',
                                }])}
                                className="mt-4"
                            >
                                Importar Item de Teste
                            </Button>
                        </Card>
                    )}
                </CardContent>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;