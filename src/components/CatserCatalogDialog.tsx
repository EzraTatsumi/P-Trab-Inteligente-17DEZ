"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CatalogoCatser } from "@/types/catalogoCatser";

interface CatserEntry {
    code: string;
    description: string;
    short_description: string | null;
}

interface CatserCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (entry: CatserEntry) => void;
}

const RESULT_LIMIT = 500;

const fetchCatalogItems = async (searchTerm: string): Promise<CatalogoCatser[]> => {
    let query = supabase
        .from('catalogo_catser' as any)
        .select('*')
        .order('code', { ascending: true })
        .limit(RESULT_LIMIT);

    const search = searchTerm.trim();
    if (search) {
        query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%,short_description.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) {
        console.error("Erro ao buscar catálogo CATSER:", error);
        throw new Error("Falha ao carregar o catálogo CATSER.");
    }
    return data as unknown as CatalogoCatser[];
};

const CatserCatalogDialog: React.FC<CatserCatalogDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: items, isLoading, error } = useQuery({
        queryKey: ['catserCatalog', debouncedSearchTerm],
        queryFn: () => fetchCatalogItems(debouncedSearchTerm),
        enabled: open,
    });

    const entries = items || [];

    if (error) {
        toast.error((error as Error).message);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-primary" />
                        Catálogo de Serviços (CATSER)
                    </DialogTitle>
                </DialogHeader>
                <div className="relative my-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por código ou descrição do serviço..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto border rounded-md">
                    {isLoading && entries.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
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
                                {!isLoading && entries.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Nenhum serviço encontrado no catálogo.
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

export default CatserCatalogDialog;