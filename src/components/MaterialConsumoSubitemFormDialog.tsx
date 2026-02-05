import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Search, FileText } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import MaterialConsumoCatalogDialog from "./MaterialConsumoCatalogDialog"; // NOVO IMPORT

// Tipo derivado da nova tabela
type MaterialConsumoSubitem = Tables<'material_consumo_subitens'>;

// Schema de validação para o formulário
const subitemSchema = z.object({
    id: z.string().optional(),
    nome: z.string().min(3, "O nome do subitem é obrigatório."),
    codigo: z.string().optional().nullable(), // Nr subitem
    unidade_medida: z.string().min(1, "A unidade de medida é obrigatória."),
    descricao: z.string().optional().nullable(), // Descrição Subitem
});

type SubitemFormValues = z.infer<typeof subitemSchema>;

interface MaterialConsumoSubitemFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subitemToEdit: MaterialConsumoSubitem | null;
    onSave: (data: SubitemFormValues) => Promise<void>;
    loading: boolean;
}

const MaterialConsumoSubitemFormDialog = ({
    open,
    onOpenChange,
    subitemToEdit,
    onSave,
    loading,
}: MaterialConsumoSubitemFormDialogProps) => {
    const [isCatalogOpen, setIsCatalogOpen] = useState(false); // NOVO ESTADO

    const form = useForm<SubitemFormValues>({
        resolver: zodResolver(subitemSchema),
        defaultValues: {
            nome: "",
            codigo: "",
            unidade_medida: "",
            descricao: "",
        },
    });

    useEffect(() => {
        if (subitemToEdit) {
            form.reset({
                id: subitemToEdit.id,
                nome: subitemToEdit.nome,
                codigo: subitemToEdit.codigo || "",
                unidade_medida: subitemToEdit.unidade_medida || "",
                descricao: subitemToEdit.descricao || "", // NOVO CAMPO
            });
        } else {
            form.reset({
                nome: "",
                codigo: "",
                unidade_medida: "",
                descricao: "",
            });
        }
    }, [subitemToEdit, form, open]);

    const onSubmit = async (data: SubitemFormValues) => {
        try {
            await onSave(data);
            onOpenChange(false);
        } catch (error) {
            // O erro já é tratado dentro do onSave no CustosOperacionaisPage, mas mantemos o fallback
            toast.error(sanitizeError(error));
        }
    };
    
    const handleSelectFromCatalog = (subitem: MaterialConsumoSubitem) => {
        // Preenche o formulário com os dados do item selecionado
        form.reset({
            id: subitem.id, // Se for um item do catálogo, ele pode ser editado
            nome: subitem.nome,
            codigo: subitem.codigo || "",
            unidade_medida: subitem.unidade_medida || "",
            descricao: subitem.descricao || "",
        });
        // Fecha o catálogo (já feito no CatalogDialog, mas garantimos)
        setIsCatalogOpen(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{subitemToEdit ? "Editar Subitem" : "Novo Subitem"} de Material de Consumo</DialogTitle>
                    </DialogHeader>
                    
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCatalogOpen(true)}
                        className="w-full"
                        disabled={loading}
                    >
                        <Search className="mr-2 h-4 w-4" />
                        Pesquisar no Catálogo
                    </Button>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        
                        <div className="space-y-2">
                            <Label htmlFor="codigo">Nr Subitem (Código)</Label>
                            <Input
                                id="codigo"
                                placeholder="Ex: 123456"
                                {...form.register("codigo")}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome Subitem</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: Kit de Primeiros Socorros"
                                {...form.register("nome")}
                            />
                            {form.formState.errors.nome && (
                                <p className="text-sm text-red-500">{form.formState.errors.nome.message}</p>
                            )}
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="descricao">Descrição Subitem (Opcional)</Label>
                            <Textarea
                                id="descricao"
                                placeholder="Detalhes sobre o uso ou especificação do material."
                                {...form.register("descricao")}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="unidade_medida">Unidade de Medida</Label>
                            <Input
                                id="unidade_medida"
                                placeholder="Ex: UN, CX, KG"
                                {...form.register("unidade_medida")}
                            />
                            {form.formState.errors.unidade_medida && (
                                <p className="text-sm text-red-500">{form.formState.errors.unidade_medida.message}</p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            
            {/* Diálogo do Catálogo */}
            <MaterialConsumoCatalogDialog
                open={isCatalogOpen}
                onOpenChange={setIsCatalogOpen}
                onSelect={handleSelectFromCatalog}
            />
        </>
    );
};

export default MaterialConsumoSubitemFormDialog;