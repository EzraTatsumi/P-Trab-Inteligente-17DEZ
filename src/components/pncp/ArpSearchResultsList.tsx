"use client";

import React, { useState } from 'react';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Package, Loader2, CheckCircle2 } from "lucide-react";
import { fetchArpItemsById } from '@/integrations/supabase/api';
import { formatCurrency, formatDate } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';

interface ArpSearchResultsListProps {
    results: ArpItemResult[];
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName?: string;
    selectedItemIds: string[];
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ 
    results, 
    onItemPreSelect, 
    searchedUasg,
    searchedOmName,
    selectedItemIds 
}) => {
    const [expandedArpId, setExpandedArpId] = useState<string | null>(null);
    const [arpItems, setArpItems] = useState<Record<string, DetailedArpItem[]>>({});
    const [loadingArpId, setLoadingArpId] = useState<string | null>(null);

    const toggleArp = async (arp: ArpItemResult) => {
        if (expandedArpId === arp.id) {
            setExpandedArpId(null);
            return;
        }

        if (!arpItems[arp.id]) {
            setLoadingArpId(arp.id);
            try {
                const items = await fetchArpItemsById(arp.numeroControlePncpAta);
                setArpItems(prev => ({ ...prev, [arp.id]: items }));
            } catch (error) {
                console.error("Erro ao carregar itens da ARP:", error);
            } finally {
                setLoadingArpId(null);
            }
        }
        setExpandedArpId(arp.id);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">
                {searchedOmName || `Resultados para UASG ${searchedUasg}`}
            </h3>
            {results.map((arp, index) => (
                <Card 
                    key={arp.id} 
                    className={cn(
                        "overflow-hidden border-2 transition-all", 
                        expandedArpId === arp.id ? "border-primary/50 shadow-md" : "hover:border-primary/30 border-primary/20",
                        index === 0 && "tour-item-pregao" // ADICIONA A IDENTIFICAÇÃO PARA O TOUR
                    )}
                >
                    <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors tour-expand-pregao" onClick={() => toggleArp(arp)}>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                    Pregão {arp.pregaoFormatado} - Ata {arp.numeroAta}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground line-clamp-1">{arp.objeto}</p>
                            </div>
                            {expandedArpId === arp.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </CardHeader>
                    {expandedArpId === arp.id && (
                        <CardContent className="p-0 border-t tour-expand-arp">
                            {loadingArpId === arp.id ? (
                                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[10%] text-center">Item</TableHead>
                                            <TableHead className="w-[60%]">Descrição</TableHead>
                                            <TableHead className="w-[20%] text-right">Valor Unit.</TableHead>
                                            <TableHead className="w-[10%]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {arpItems[arp.id]?.map((item) => {
                                            const isSelected = selectedItemIds.includes(item.id);
                                            const isMocked = item.id === 'ghost-item-cimento';
                                            return (
                                                <TableRow key={item.id} className={cn(isSelected && "bg-primary/5", isMocked && "tour-item-mockado")}>
                                                    <TableCell className="text-center font-mono text-xs">{item.codigoItem}</TableCell>
                                                    <TableCell className="text-xs font-medium">{item.descricaoItem}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(item.valorUnitario)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button 
                                                            variant={isSelected ? "default" : "outline"} 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => onItemPreSelect(item, arp.pregaoFormatado, arp.uasg)}
                                                        >
                                                            {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
};

export default ArpSearchResultsList;