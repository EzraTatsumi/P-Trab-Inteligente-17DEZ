import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OMData } from './OmSelector'; // Reutiliza o tipo OMData
import { formatCodug } from '@/lib/formatUtils';

interface OmSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (uasg: string) => void;
}

// Função de busca de OMs (reutilizada do OmSelector)
const fetchOms = async (): Promise<OMData[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('ativo', true)
        .order('nome_om', { ascending: true });

    if (error) throw error;
    return data as OMData[];
};

const OmSelectorDialog: React.FC<OmSelectorDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
}) => {
    const { data: items, isLoading, error } = useQuery({
        queryKey: ['organizacoesMilitares'],
        queryFn: fetchOms,
        enabled: open,
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUasg, setSelectedUasg] = useState<string | null>(null);
    
    const filteredItems = (items || []).filter(item => 
        item.nome_om.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codug_om.includes(searchTerm)
    );
    
    const handlePreSelect = (item: OMData) => {
        if (selectedUasg === item.codug_om) {
            setSelectedUasg(null);
        } else {
            setSelectedUasg(item.codug_om);
        }
    };

    const handleConfirmImport = () => {
        if (selectedUasg) {
            onSelect(selectedUasg);
            onOpenChange(false);
            toast.success(`UASG ${formatCodug(selectedUasg)} importada com sucesso.`);
        }
    };

    if (error) {
        toast.error(error.message || "Erro ao carregar OMs.");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Catálogo de Organizações Militares (UASG)</DialogTitle>
                    <DialogDescription>
                        Selecione uma OM para importar o Código da Unidade Gestora (CODUG) como UASG.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por sigla, nome ou CODUG..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    
                    {isLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Carregando OMs...</p>
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
                                        <TableHead className="w-[250px]">Sigla</TableHead>
                                        <TableHead>RM Vinculação</TableHead>
                                        <TableHead className="w-[120px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map(item => {
                                        const isSelected = selectedUasg === item.codug_om;
                                        return (
                                            <TableRow 
                                                key={item.id} 
                                                className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"}`}
                                                onClick={() => handlePreSelect(item)}
                                            >
                                                <TableCell className="font-semibold text-center">{formatCodug(item.codug_om)}</TableCell>
                                                <TableCell className="font-medium">{item.nome_om}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{item.rm_vinculacao}</TableCell>
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
                        disabled={!selectedUasg}
                    >
                        <Check className="h-4 w-4 mr-2" />
                        Importar UASG
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