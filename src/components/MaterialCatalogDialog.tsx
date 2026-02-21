"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MaterialCatalogEntry {
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
}

interface MaterialCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (entry: MaterialCatalogEntry) => void;
}

const MaterialCatalogDialog: React.FC<MaterialCatalogDialogProps> = ({ open, onOpenChange, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [entries, setEntries] = useState<MaterialCatalogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchEntries();
        }
    }, [open]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('catalogo_subitens_nd')
                .select('nr_subitem, nome_subitem, descricao_subitem')
                .eq('ativo', true)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error("Erro ao carregar catálogo de materiais:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = entries.filter(entry => 
        entry.nr_subitem.includes(searchTerm) || 
        entry.nome_subitem.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Catálogo de Subitens (ND 339030)
                    </DialogTitle>
                </DialogHeader>
                
                <div className="relative my-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por número ou nome do subitem..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-md">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Número</TableHead>
                                    <TableHead>Nome do Subitem</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.map((entry) => (
                                    <TableRow key={entry.nr_subitem}>
                                        <TableCell className="font-bold">{entry.nr_subitem}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{entry.nome_subitem}</div>
                                            {entry.descricao_subitem && (
                                                <div className="text-xs text-muted-foreground line-clamp-1">
                                                    {entry.descricao_subitem}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" onClick={() => onSelect(entry)}>Selecionar</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredEntries.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            Nenhum subitem encontrado.
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

export default MaterialCatalogDialog;