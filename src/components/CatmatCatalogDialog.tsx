import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, Search, Import } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CatmatItem } from "@/types/catalogoCatmat";

// Definindo o tipo de item selecionável para o estado
type SelectedItem = { code: string, description: string } | null;

interface CatmatCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { code: string, description: string }) => void;
}

const fetchCatalogItems = async (): Promise<CatmatItem[]> => {
    const { data, error } = await supabase
        .from('catalogo_catmat')
        .select('*')
        .order('code', { ascending: true });

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
    const { data: items, isLoading, error } = useQuery({
        queryKey: ['catmatCatalog'],
        queryFn: fetchCatalogItems,
        enabled: open,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    
    const filteredItems = (items || []).filter(item => 
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Catálogo CATMAT</DialogTitle>
                    <DialogDescription>
                        Selecione um item de referência do CATMAT e confirme a importação.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por código ou descrição do item..."
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
                            Nenhum item CATMAT encontrado.
                        </div>
                    ) : (
                        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[150px] text-center">Código</TableHead>
                                        <TableHead className="text-center">Descrição</TableHead>
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
                                                <TableCell className="font-medium text-sm text-muted-foreground max-w-lg whitespace-normal">
                                                    <span className="block text-foreground">{item.description || 'N/A'}</span>
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
                                                        <Check className="h-4 w-4 mr-1" />
                                                        {isSelected ? "Selecionado" : "Selecionar"}
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