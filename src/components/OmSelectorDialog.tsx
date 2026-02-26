"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, Search, Import } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatCodug } from '@/lib/formatUtils';
import { Tables } from '@/integrations/supabase/types';

// Tipo para a OM (Unidade Gestora)
type OmItem = Tables<'organizacoes_militares'>;

interface OmSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (om: OmItem) => void;
}

const fetchOmItems = async (): Promise<OmItem[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('ativo', true)
        .order('nome_om', { ascending: true });

    if (error) {
        console.error("Erro ao buscar catálogo de OMs:", error);
        throw new Error("Falha ao carregar o catálogo de OMs.");
    }
    
    return data as OmItem[];
};

const OmSelectorDialog: React.FC<OmSelectorDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
}) => {
    const { data: items, isLoading, error } = useQuery({
        queryKey: ['omCatalog'],
        queryFn: fetchOmItems,
        enabled: open,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<OmItem | null>(null);
    
    const filteredItems = (items || []).filter(item => 
        item.codug_om.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nome_om.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const handlePreSelect = (item: OmItem) => {
        if (selectedItem?.id === item.id) {
            setSelectedItem(null);
        } else {
            setSelectedItem(item);
        }
    };

    const handleConfirmImport = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            onOpenChange(false);
            toast.success(`UASG ${formatCodug(selectedItem.codug_om)} selecionada.`);
        }
    };

    if (error) {
        toast.error(error.message);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Catálogo de Unidades Gestoras (UASG)</DialogTitle>
                    <DialogDescription>
                        Selecione uma OM para preencher o campo UASG (CODUG) na busca PNCP.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por sigla, CODUG ou cidade..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    
                    {isLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Carregando catálogo de OMs...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhuma OM encontrada.
                        </div>
                    ) : (
                        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[150px] text-center">CODUG (UASG)</TableHead>
                                        <TableHead className="text-center">Sigla OM</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => {
                                        const isSelected = selectedItem?.id === item.id;
                                        return (
                                            <TableRow 
                                                key={item.id} 
                                                className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"}`}
                                                onClick={() => handlePreSelect(item)}
                                            >
                                                <TableCell className="font-semibold text-center">{formatCodug(item.codug_om)}</TableCell>
                                                <TableCell className="font-medium text-center">{item.nome_om}</TableCell>
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
                        Confirmar Seleção
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

export default OmSelectorDialog;