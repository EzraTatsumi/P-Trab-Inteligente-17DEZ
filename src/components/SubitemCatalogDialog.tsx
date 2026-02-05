import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CatalogoSubitem } from "@/types/catalogoSubitens";
import { Input } from "@/components/ui/input";

interface SubitemCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { nr_subitem: string, nome_subitem: string, descricao_subitem: string | null }) => void;
}

const fetchCatalogItems = async (): Promise<CatalogoSubitem[]> => {
    const { data, error } = await supabase
        .from('catalogo_subitens_nd')
        .select('*')
        .eq('ativo', true)
        .order('nr_subitem', { ascending: true });

    if (error) {
        console.error("Erro ao buscar catálogo de subitens:", error);
        throw new Error("Falha ao carregar o catálogo de subitens.");
    }
    
    return data as CatalogoSubitem[];
};

const SubitemCatalogDialog: React.FC<SubitemCatalogDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
}) => {
    const { data: items, isLoading, error } = useQuery({
        queryKey: ['subitemCatalog'],
        queryFn: fetchCatalogItems,
        enabled: open,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredItems = (items || []).filter(item => 
        item.nr_subitem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nome_subitem.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.descricao_subitem?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const handleSelect = (item: CatalogoSubitem) => {
        onSelect({
            nr_subitem: item.nr_subitem,
            nome_subitem: item.nome_subitem,
            descricao_subitem: item.descricao_subitem,
        });
    };

    if (error) {
        toast.error(error.message);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Catálogo de Subitens da ND</DialogTitle>
                    <DialogDescription>
                        Selecione um subitem de referência para preencher os dados básicos do seu registro.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por número ou nome do subitem..."
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
                            Nenhum subitem encontrado.
                        </div>
                    ) : (
                        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[100px] text-center">Nr Subitem</TableHead>
                                        <TableHead className="w-[200px] text-center">Nome do Subitem</TableHead>
                                        <TableHead className="text-center">Descrição</TableHead>
                                        <TableHead className="w-[80px] text-right text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => (
                                        <TableRow key={item.id} className="group">
                                            <TableCell className="font-semibold text-center">{item.nr_subitem}</TableCell>
                                            <TableCell className="font-medium">{item.nome_subitem}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-lg whitespace-normal">
                                                {/* Container que expande no hover da linha (group-hover) */}
                                                <div className="overflow-hidden max-h-[4.5rem] relative transition-all duration-300 group-hover:max-h-[20rem] group-hover:overflow-visible"> 
                                                    <span className="block">{item.descricao_subitem || 'N/A'}</span>
                                                    {/* Gradiente que desaparece no hover */}
                                                    {item.descricao_subitem && item.descricao_subitem.length > 100 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-0" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={() => handleSelect(item)}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Selecionar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SubitemCatalogDialog;