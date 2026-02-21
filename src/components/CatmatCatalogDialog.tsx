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

    useEffect(() => {
        if (open) {
            fetchEntries();
        }
    }, [open]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('catalogo_catmat')
                .select('code, description, short_description')
                .order('description', { ascending: true });

            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error("Erro ao carregar catálogo CATMAT:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = entries.filter(entry => 
        entry.code.includes(searchTerm) || 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.short_description && entry.short_description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Código</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.map((entry) => (
                                    <TableRow key={entry.code}>
                                        <TableCell className="font-mono text-xs">{entry.code}</TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{entry.description}</div>
                                            {entry.short_description && (
                                                <div className="text-xs text-muted-foreground">
                                                    Reduzido: {entry.short_description}
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
                                            Nenhum item encontrado no catálogo local.
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