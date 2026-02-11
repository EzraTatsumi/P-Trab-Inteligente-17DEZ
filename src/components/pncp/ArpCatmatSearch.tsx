import React, { useState, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Trash2 } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { fetchArpItemsByCatmat } from '@/integrations/supabase/api';
import { DetailedArpItem } from '@/types/pncp';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCodug, formatCurrency, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';

interface ArpCatmatSearchProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ArpCatmatSearch: React.FC<ArpCatmatSearchProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [codigoItem, setCodigoItem] = useState('');
    const [isSearchTriggered, setIsSearchTriggered] = useState(false);
    
    const resultHeaderRef = useRef<HTMLDivElement>(null);

    const { data: results, isLoading, isError, error } = useQuery({
        queryKey: ['arpItemsByCatmat', codigoItem],
        queryFn: () => fetchArpItemsByCatmat({ 
            codigoItem, 
            dataVigenciaInicialMin: '', 
            dataVigenciaInicialMax: '' 
        }),
        enabled: isSearchTriggered && !!codigoItem,
        staleTime: 1000 * 60 * 5,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!codigoItem) {
            toast.error("Informe o código do item (CATMAT ou CATSER).");
            return;
        }
        setIsSearchTriggered(true);
        
        // Rola para o topo dos resultados após um pequeno delay
        setTimeout(() => {
            resultHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearch} className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="codigoItem">Código do Item (CATMAT/CATSER) *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="codigoItem"
                                placeholder="Ex: 123456"
                                value={codigoItem}
                                onChange={(e) => {
                                    setCodigoItem(e.target.value.replace(/\D/g, ''));
                                    setIsSearchTriggered(false);
                                }}
                            />
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                Buscar
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            {isSearchTriggered && (
                <div className="space-y-4" ref={resultHeaderRef}>
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">
                            Resultados para o Código {codigoItem}
                            {results && <span className="text-sm font-normal text-muted-foreground ml-2">({results.length} itens encontrados)</span>}
                        </h3>
                        {selectedItemIds.length > 0 && (
                            <Button variant="outline" size="sm" onClick={onClearSelection} className="text-red-600 border-red-200 hover:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Limpar Seleção ({selectedItemIds.length})
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            <p className="text-muted-foreground mt-2">Consultando PNCP...</p>
                        </div>
                    ) : isError ? (
                        <div className="text-center py-12 text-red-500">
                            Erro ao buscar itens: {(error as Error).message}
                        </div>
                    ) : results && results.length > 0 ? (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[15%]">Pregão</TableHead>
                                        <TableHead className="w-[15%]">UASG / OM</TableHead>
                                        <TableHead className="w-[40%]">Descrição do Item</TableHead>
                                        <TableHead className="w-[15%] text-center">Qtd. Homologada</TableHead>
                                        <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map(item => {
                                        const isSelected = selectedItemIds.includes(item.id);
                                        return (
                                            <TableRow 
                                                key={item.id}
                                                className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                                onClick={() => onItemPreSelect(item, item.pregaoFormatado, item.uasg)}
                                            >
                                                <TableCell className="font-medium text-xs">
                                                    {formatPregao(item.pregaoFormatado)}
                                                    <div className="text-[10px] text-muted-foreground mt-1">ARP: {item.numeroAta}</div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="font-semibold">{formatCodug(item.uasg)}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.omNome}</div>
                                                </TableCell>
                                                <TableCell className="text-[0.7rem] max-w-md whitespace-normal">
                                                    {capitalizeFirstLetter(item.descricaoItem)}
                                                </TableCell>
                                                <TableCell className="text-center text-xs">
                                                    {item.quantidadeHomologada.toLocaleString('pt-BR')}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-bold text-primary">
                                                    {formatCurrency(item.valorUnitario)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                            Nenhum item encontrado para este código no período consultado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArpCatmatSearch;