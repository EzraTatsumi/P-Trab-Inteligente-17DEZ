"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CatmatEntry {
    code: string;
    description: string;
    short_description: string | null;
}

interface CatmatCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (entry: CatmatEntry) => void;
}

const CatmatCatalogDialog: React.FC<CatmatCatalogDialogProps> = ({ open, onOpenChange, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [entries, setEntries] = useState<CatmatEntry[]>([]);
    const [loading, setLoading] = useState(false);

    /**
     * Função de Busca Inteligente:
     * Trata o termo de busca para evitar erros de tipagem no PostgreSQL
     * e otimiza a recuperação dos itens do catálogo.
     */
    const fetchCatalogItems = async (searchTerm: string) => {
        setLoading(true);
        try {
            let query = supabase
                .from('catalogo_catmat')
                .select('*')
                .order('code', { ascending: true })
                .limit(500);

            const search = searchTerm.trim();
            if (search) {
                // Busca Inteligente: Verifica se o termo contém apenas números
                const isNumeric = /^\d+$/.test(search);
                
                if (isNumeric) {
                    // Se for número, busca exata no código ou parcial nas descrições
                    query = query.or(`code.eq.${search},description.ilike.%${search}%,short_description.ilike.%${search}%`);
                } else {
                    // Se for texto, busca apenas nas descrições para evitar erro de tipo na coluna 'code' (numérica)
                    query = query.or(`description.ilike.%${search}%,short_description.ilike.%${search}%`);
                }
            }

            const { data, error } = await query;
            if (error) {
                console.error("Erro ao buscar catálogo CATMAT:", error);
                throw new Error("Falha ao carregar o catálogo CATMAT.");
            }
            setEntries((data as CatmatEntry[]) || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Gatilho de busca com debounce simples
    useEffect(() => {
        if (open) {
            const timeoutId = setTimeout(() => {
                fetchCatalogItems(searchTerm);
            }, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [open, searchTerm]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Catálogo de Itens (CATMAT)
                    </DialogTitle>
                </DialogHeader>
                
                <div className="relative my-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por código ou descrição do item..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-md">
                    {loading && entries.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px] text-center">Código</TableHead>
                                    <TableHead className="w-[200px] text-center">Nome Reduzido</TableHead>
                                    <TableHead className="text-center">Descrição Completa</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((entry) => (
                                    <TableRow key={entry.code}>
                                        <TableCell className="font-semibold text-center">{entry.code}</TableCell>
                                        <TableCell className="font-medium">{entry.short_description || 'N/A'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-lg whitespace-normal">
                                            <span className="block">{entry.description || 'N/A'}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" onClick={() => onSelect(entry)}>Selecionar</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!loading && entries.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Nenhum item encontrado no catálogo.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CatmatCatalogDialog;