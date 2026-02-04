import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { 
    DiretrizMaterialConsumoCategoria, 
    DiretrizMaterialConsumoCategoriaForm, 
    materialConsumoCategoriaSchema 
} from "@/types/diretrizesMaterialConsumo";

interface MaterialConsumoCategoriaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedYear: number;
  diretrizToEdit: DiretrizMaterialConsumoCategoria | null;
  onSave: (data: DiretrizMaterialConsumoCategoriaForm & { id?: string }) => Promise<void>;
  loading: boolean;
}

const MaterialConsumoCategoriaFormDialog: React.FC<MaterialConsumoCategoriaFormDialogProps> = ({
  open,
  onOpenChange,
  selectedYear,
  diretrizToEdit,
  onSave,
  loading,
}) => {
  const form = useForm<DiretrizMaterialConsumoCategoriaForm>({
    resolver: zodResolver(materialConsumoCategoriaSchema),
    defaultValues: {
      nome_categoria: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (diretrizToEdit) {
      form.reset({
        nome_categoria: diretrizToEdit.nome_categoria,
        observacoes: diretrizToEdit.observacoes || "",
      });
    } else {
      form.reset({
        nome_categoria: "",
        observacoes: "",
      });
    }
  }, [diretrizToEdit, form, open]);

  const onSubmit = async (data: DiretrizMaterialConsumoCategoriaForm) => {
    await onSave({
      ...data,
      id: diretrizToEdit?.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{diretrizToEdit ? "Editar Categoria" : "Nova Categoria"} de Material de Consumo</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-muted-foreground">Ano de Referência: {selectedYear}</p>
            
            <FormField
              control={form.control}
              name="nome_categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Categoria (Subitem ND 30)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Material de Expediente" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalhes sobre a aplicação desta categoria..." {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Categoria
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialConsumoCategoriaFormDialog;
