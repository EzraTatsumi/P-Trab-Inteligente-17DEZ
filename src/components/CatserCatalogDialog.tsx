"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, Search, Import } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CatalogoCatser } from "@/types/catalogoCatser";

type SelectedItem = { code: string, description: string, short_description: string | null } | null;

interface CatserCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { code: string, description: string, short_description: string | null }) => void;
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
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
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

    const filteredItems = items || [];

    const handlePreSelect = (item: CatalogoCatser) => {
        const newItem = {
            code: item.code,
            description: item.description,
            short_description: item.short_description,
        };

        if (selectedItem?.code === item.code) {
            setSelectedItem(null);
        } else {
            setSelectedItem(newItem);
        }
    };

    const handleConfirmImport = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            onOpenChange(false);
            toast.success(`Item CATSER ${selectedItem.code} importado com sucesso.`);
        }
    };

    if (error) {
        toast.error((error as Error).message);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Catálogo de Serviços (CATSER)</DialogTitle>
                    <DialogDescription>
                        Selecione um item do catálogo para preencher o código e a descrição.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por código, descrição ou nome reduzido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    
                    {isLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Carregando catálogo...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum item CATSER encontrado.
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Exibindo {filteredItems.length} resultados. Refine sua busca se não encontrar o item desejado.
                            </p>
                            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[120px] text-center">Código</TableHead>
                                            <TableHead className="w-[200px] text-center">Nome Reduzido</TableHead>
                                            <TableHead className="text-center">Descrição Completa</TableHead>
                                            <TableHead className="w-[120px] text-center">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map(item => {
                                            const isSelected = selectedItem?.code === item.code;
                                            return (
                                                <TableRow 
                                                    key={item.id} 
                                                    className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"}`}
                                                    onClick={() => handlePreSelect(item)}
                                                >
                                                    <TableCell className="font-semibold text-center">{item.code}</TableCell>
                                                    <TableCell className="font-medium">{item.short_description || 'N/A'}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground max-w-lg whitespace-normal">
                                                        <span className="block">{item.description || 'N/A'}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant={isSelected ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); 
                                                                handlePreSelect(item);
                                                            }}
                                                        >
                                                            {isSelected ? (
                                                                <>
                                                                    <Check className="h-4 w-4 mr-1" />
                                                                    Selecionado
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check className="h-4 w-4 mr-1" />
                                                                    Selecionar
                                                                </>
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                        type="button" 
                        onClick={handleConfirmImport}
                        disabled={!selectedItem}
                    >
                        <Import className="h-4 w-4 mr-2" />
                        Confirmar Importação
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CatserCatalogDialog;