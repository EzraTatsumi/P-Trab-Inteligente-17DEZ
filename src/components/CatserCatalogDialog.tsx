"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CatserEntry {
    code: string;
    description: string;
    short_description: string | null;
}

interface CatserCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: CatserEntry) => void;
}

const CatserCatalogDialog: React.FC<CatserCatalogDialogProps> = ({ open, onOpenChange, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [entries, setEntries] = useState<CatserEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchEntries();
        }
    }, [open]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            // Using type assertion to fix the SelectQueryError inference issue
            const { data, error } = await (supabase.from('catalogo_catser' as any) as any)
                .select('code, description, short_description');
            
            if (error) throw error;
            
            setEntries((data as any) || []);
        } catch (error) {
            console.error("Erro ao buscar catálogo CATSER:", error);
            toast.error("Falha ao carregar catálogo.");
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = entries.filter(entry => 
        entry.code.includes(searchTerm) || 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.short_description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Catálogo de Serviços (CATSER)</DialogTitle>
                </DialogHeader>
                <div className="relative my-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por código ou descrição..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-10"
                    />
                </div>
                <div className="flex-1 overflow-y-auto border rounded-md">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Código</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="w-[100px] text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            Nenhum serviço encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEntries.map((entry) => (
                                        <TableRow key={entry.code}>
                                            <TableCell className="font-medium text-xs">{entry.code}</TableCell>
                                            <TableCell>
                                                <p className="font-semibold text-sm">{entry.short_description || entry.description.split('\n')[0]}</p>
                                                <p className="text-[10px] text-muted-foreground line-clamp-2">{entry.description}</p>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => onSelect(entry)}>Selecionar</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
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