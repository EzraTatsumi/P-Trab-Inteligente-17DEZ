"use client";

import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2, Package, Info, CheckCircle2 } from "lucide-react";
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import { formatCurrency, formatCodug, capitalizeFirstLetter } from '@/lib/formatUtils';
import { fetchArpItemsById } from '@/integrations/supabase/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isGhostMode, GHOST_DATA } from '@/lib/ghostStore';

interface ArpSearchResultsListProps {
    results: ArpItemResult[];
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName: string;
    selectedItemIds: string[];
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ 
    results, 
    onItemPreSelect, 
    searchedUasg, 
    searchedOmName,
    selectedItemIds 
}) => {
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [openArps, setOpenArps] = useState<Set<string>>(new Set());
    const [arpItems, setArpItems] = useState<Record<string, DetailedArpItem[]>>({});
    const [loadingArps, setLoadingArps] = useState<Set<string>>(new Set());

    const groupedResults = results.reduce((acc, item) => {
        const key = item.pregaoFormatado;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, ArpItemResult[]>);

    const toggleGroup = (pregao: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(pregao)) next.delete(pregao);
            else next.add(pregao);
            return next;
        });
    };

    const toggleArp = async (arp: ArpItemResult) => {
        const key = arp.numeroControlePncpAta;
        if (openArps.has(key)) {
            setOpenArps(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
            return;
        }

        if (!arpItems[key]) {
            setLoadingArps(prev => new Set(prev).add(key));
            try {
                let items: DetailedArpItem[] = [];
                if (isGhostMode() && key === '160222-ARP-001-2025') {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    items = GHOST_DATA.missao_02.arp_detailed_items;
                } else {
                    items = await fetchArpItemsById(key);
                }
                setArpItems(prev => ({ ...prev, [key]: items }));
            } catch (error: any) {
                toast.error(`Falha ao carregar itens da ARP: ${error.message}`);
            } finally {
                setLoadingArps(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        }

        setOpenArps(prev => new Set(prev).add(key));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                    Resultados para {searchedOmName || `UASG ${searchedUasg}`}
                </h3>
                <Badge variant="outline">{results.length} ARP(s) encontrada(s)</Badge>
            </div>

            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Pregão / ARP</TableHead>
                            <TableHead className="hidden md:table-cell">Objeto</TableHead>
                            <TableHead className="text-right">Vigência</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(groupedResults).map(([pregao, arps]) => {
                            const isGroupOpen = openGroups.has(pregao);
                            return (
                                <React.Fragment key={pregao}>
                                    <TableRow 
                                        className="cursor-pointer hover:bg-muted/30 bg-muted/10"
                                        onClick={() => toggleGroup(pregao)}
                                    >
                                        <TableCell className="text-center">
                                            {isGroupOpen ? <ChevronUp className="h-4 w-4 tour-expand-pregao" /> : <ChevronDown className="h-4 w-4 tour-expand-pregao" />}
                                        </TableCell>
                                        <TableCell className="font-bold text-primary">
                                            Pregão {pregao}
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">({arps.length} ARP)</span>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground italic">
                                            {arps[0].objeto.substring(0, 80)}...
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            Várias
                                        </TableCell>
                                    </TableRow>

                                    {isGroupOpen && arps.map(arp => {
                                        const isArpOpen = openArps.has(arp.numeroControlePncpAta);
                                        const isLoading = loadingArps.has(arp.numeroControlePncpAta);
                                        
                                        return (
                                            <React.Fragment key={arp.numeroControlePncpAta}>
                                                <TableRow 
                                                    className={cn(
                                                        "cursor-pointer hover:bg-primary/5 border-l-4 border-l-primary/20",
                                                        isArpOpen && "bg-primary/5 border-l-primary"
                                                    )}
                                                    onClick={() => toggleArp(arp)}
                                                >
                                                    <TableCell className="text-center">
                                                        {isLoading ? (
                                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                        ) : (
                                                            isArpOpen ? <ChevronUp className="h-3 w-3 tour-expand-arp" /> : <ChevronDown className="h-3 w-3 tour-expand-arp" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="pl-8 text-sm font-medium">
                                                        ARP {arp.numeroAta}
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell text-[0.7rem] text-muted-foreground leading-tight">
                                                        {arp.objeto}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[0.7rem] whitespace-nowrap">
                                                        {new Date(arp.dataVigenciaFinal).toLocaleDateString('pt-BR')}
                                                    </TableCell>
                                                </TableRow>

                                                {isArpOpen && arpItems[arp.numeroControlePncpAta] && (
                                                    <TableRow className="bg-muted/5 hover:bg-transparent">
                                                        <TableCell colSpan={4} className="p-0">
                                                            <div className="p-4 bg-background/50 border-y">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="hover:bg-transparent">
                                                                            <TableHead className="h-8 text-[0.65rem] uppercase">Cód. Item</TableHead>
                                                                            <TableHead className="h-8 text-[0.65rem] uppercase">Descrição Técnica</TableHead>
                                                                            <TableHead className="h-8 text-[0.65rem] uppercase text-right">Valor Unit.</TableHead>
                                                                            <TableHead className="h-8 text-[0.65rem] uppercase text-center">Ação</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {arpItems[arp.numeroControlePncpAta].map(item => {
                                                                            const isSelected = selectedItemIds.includes(item.id);
                                                                            const isMockItem = item.id === 'ghost-item-cimento';
                                                                            
                                                                            return (
                                                                                <TableRow 
                                                                                    key={item.id} 
                                                                                    className={cn(
                                                                                        "hover:bg-primary/5 transition-colors",
                                                                                        isSelected && "bg-green-50 hover:bg-green-100",
                                                                                        isMockItem && "tour-item-mockado"
                                                                                    )}
                                                                                >
                                                                                    <TableCell className="text-xs font-medium py-2">{item.codigoItem}</TableCell>
                                                                                    <TableCell className="text-[0.7rem] max-w-lg whitespace-normal py-2 leading-relaxed">
                                                                                        {capitalizeFirstLetter(item.descricaoItem)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right text-xs font-bold py-2">
                                                                                        {formatCurrency(item.valorUnitario)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-center py-2">
                                                                                        <Button 
                                                                                            size="sm" 
                                                                                            variant={isSelected ? "default" : "outline"}
                                                                                            className={cn("h-7 px-2 text-[10px]", isSelected && "bg-green-600 hover:bg-green-700")}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                onItemPreSelect(item, arp.pregaoFormatado, arp.uasg);
                                                                                            }}
                                                                                        >
                                                                                            {isSelected ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Package className="h-3 w-3 mr-1" />}
                                                                                            {isSelected ? "Selecionado" : "Selecionar"}
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            );
                                                                        })}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default ArpSearchResultsList;