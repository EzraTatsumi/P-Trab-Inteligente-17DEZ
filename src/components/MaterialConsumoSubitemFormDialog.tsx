import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Tipo derivado da nova tabela
type MaterialConsumoSubitem = Tables<'material_consumo_subitens'>;

// Schema de validação para o formulário
const subitemSchema = z.object({
    id: z.string().optional(),
    nome: z.string().min(3, "O nome do subitem é obrigatório."),
    codigo: z.string().optional().nullable(),
    unidade_medida: z.string().min(1, "A unidade de medida é obrigatória."),
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
    const form = useForm<SubitemFormValues>({
        resolver: zodResolver(subitemSchema),
        defaultValues: {
            nome: "",
            codigo: "",
            unidade_medida: "",
        },
    });

    useEffect(() => {
        if (subitemToEdit) {
            form.reset({
                id: subitemToEdit.id,
                nome: subitemToEdit.nome,
                codigo: subitemToEdit.codigo || "",
                unidade_medida: subitemToEdit.unidade_medida || "",
            });
        } else {
            form.reset({
                nome: "",
                codigo: "",
                unidade_medida: "",
            });
        }
    }, [subitemToEdit, form, open]);

    const onSubmit = async (data: SubitemFormValues) => {
        try {
            await onSave(data);
            onOpenChange(false);
        } catch (error) {
            toast.error(sanitizeError(error));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{subitemToEdit ? "Editar Subitem" : "Novo Subitem"} de Material de Consumo</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Subitem</Label>
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
                        <Label htmlFor="codigo">Código (Opcional)</Label>
                        <Input
                            id="codigo"
                            placeholder="Ex: 123456"
                            {...form.register("codigo")}
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
    );
};

export default MaterialConsumoSubitemFormDialog;