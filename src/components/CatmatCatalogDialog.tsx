import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, Search, Import, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tables } from '@/integrations/supabase/types';

// Definindo o tipo de item do catálogo CATMAT
export interface CatmatItem extends Tables<'catalogo_catmat'> {}

// Definindo o tipo de item selecionável para o estado
type SelectedItem = { code: string, description: string } | null;

interface CatmatCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { code: string, description: string }) => void;
}

/**
 * Fetches CATMAT items from Supabase, applying server-side filtering.
 * @param searchTerm Termo de busca fornecido pelo usuário.
 */
const fetchCatmatItems = async (searchTerm: string): Promise<CatmatItem[]> => {
    // A busca deve ser case-insensitive e buscar em código ou descrição
    const searchPattern = `%${searchTerm.toLowerCase()}%`;
    
    const { data, error } = await supabase
        .from('catalogo_catmat')
        .select('*')
        .or(`code.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .order('code', { ascending: true })
        .limit(100); // Limita o resultado da busca para evitar sobrecarga, mesmo com filtro

    if (error) {
        console.error("Erro ao buscar catálogo CATMAT:", error);
        throw new Error("Falha ao carregar o catálogo CATMAT.");
    }
    
    return data as CatmatItem[];
};

const CatmatCatalogDialog: React.FC<CatmatCatalogDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    
    // Condição para habilitar a query: diálogo aberto E termo de busca com pelo menos 3 caracteres
    const isSearchEnabled = open && searchTerm.length >= 3;

    const { data: items, isLoading, error } = useQuery({
        queryKey: ['catmatCatalog', searchTerm],
        queryFn: () => fetchCatmatItems(searchTerm),
        enabled: isSearchEnabled,
    });
    
    const handlePreSelect = (item: CatmatItem) => {
        const newItem = {
            code: item.code,
            description: item.description,
        };

        if (selectedItem?.code === item.code) {
            // Desselecionar se já estiver selecionado
            setSelectedItem(null);
        } else {
            // Selecionar o novo item
            setSelectedItem(newItem);
        }
    };

    const handleConfirmImport = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            onOpenChange(false);
            toast.success(`Item CATMAT ${selectedItem.code} importado com sucesso.`);
        }
    };

    if (error) {
        toast.error(error.message);
    }
    
    const displayItems = items || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Catálogo CATMAT
                    </DialogTitle>
                    <DialogDescription>
                        Busque por código ou descrição para encontrar itens de material de consumo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Digite pelo menos 3 caracteres para buscar (Ex: CANETA, 4410)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    
                    {isLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Buscando itens...</p>
                        </div>
                    ) : !isSearchEnabled ? (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                            <Search className="h-8 w-8 mx-auto mb-2" />
                            <p className="font-medium">Digite pelo menos 3 caracteres para iniciar a busca no catálogo.</p>
                        </div>
                    ) : displayItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                            <p className="font-medium">Nenhum item encontrado para o termo "{searchTerm}".</p>
                        </div>
                    ) : (
                        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[150px] text-center">Código</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayItems.map(item => {
                                        const isSelected = selectedItem?.code === item.code;
                                        return (
                                            <TableRow 
                                                key={item.id} 
                                                className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"}`}
                                                onClick={() => handlePreSelect(item)}
                                            >
                                                <TableCell className="font-semibold text-center">{item.code}</TableCell>
                                                <TableCell className="font-medium text-sm">{item.description}</TableCell>
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

export default CatmatCatalogDialog;