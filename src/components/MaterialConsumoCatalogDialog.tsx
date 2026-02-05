import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// Tipo derivado da tabela, incluindo o novo campo 'descricao'
type MaterialConsumoSubitem = Tables<'material_consumo_subitens'>;

interface MaterialConsumoCatalogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (subitem: MaterialConsumoSubitem) => void;
}

const fetchCatalogSubitems = async (): Promise<MaterialConsumoSubitem[]> => {
    // Nota: Devido ao RLS, esta consulta só retornará os itens criados pelo usuário.
    // Se o catálogo fosse global, a política RLS precisaria ser ajustada.
    const { data, error } = await supabase
        .from('material_consumo_subitens')
        .select('*')
        .order('nome', { ascending: true });

    if (error) {
        console.error("Erro ao buscar catálogo de subitens:", error);
        throw new Error("Falha ao carregar o catálogo.");
    }
    return data as MaterialConsumoSubitem[];
};

const MaterialConsumoCatalogDialog = ({
    open,
    onOpenChange,
    onSelect,
}: MaterialConsumoCatalogDialogProps) => {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: subitems = [], isLoading, error } = useQuery<MaterialConsumoSubitem[]>({
        queryKey: ['materialConsumoCatalog'],
        queryFn: fetchCatalogSubitems,
        enabled: open,
    });
    
    if (error) {
        toast.error(error.message);
    }

    const filteredSubitems = useMemo(() => {
        if (!searchTerm) return subitems;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return subitems.filter(item => 
            item.nome.toLowerCase().includes(lowerCaseSearch) ||
            item.codigo?.toLowerCase().includes(lowerCaseSearch) ||
            item.descricao?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [subitems, searchTerm]);

    const handleSelect = (item: MaterialConsumoSubitem) => {
        onSelect(item);
        onOpenChange(false);
        setSearchTerm(""); // Limpa a busca ao fechar
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Pesquisar no Catálogo de Subitens
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <Input
                        placeholder="Buscar por nome, código ou descrição..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                    />

                    <ScrollArea className="h-[400px] border rounded-md">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-full p-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">Carregando catálogo...</span>
                            </div>
                        ) : filteredSubitems.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">
                                Nenhum subitem encontrado.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Nr Subitem</TableHead>
                                        <TableHead>Nome Subitem</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="w-[80px] text-center">Unidade</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSubitems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.codigo || '-'}</TableCell>
                                            <TableCell>{item.nome}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                                {item.descricao || 'Sem descrição'}
                                            </TableCell>
                                            <TableCell className="text-center">{item.unidade_medida || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleSelect(item)}
                                                >
                                                    <Check className="h-4 w-4 text-green-600" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="mr-2 h-4 w-4" />
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoCatalogDialog;