import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { 
    DiretrizMaterialConsumoItem, 
    DiretrizMaterialConsumoItemForm, 
    materialConsumoItemSchema 
} from "@/types/diretrizesMaterialConsumo";
import CurrencyInput from "@/components/CurrencyInput";
import { numberToRawDigits, formatCurrencyInput } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

interface MaterialConsumoItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoriaId: string;
  categoriaNome: string;
  itemToEdit: DiretrizMaterialConsumoItem | null;
}

const MaterialConsumoItemFormDialog: React.FC<MaterialConsumoItemFormDialogProps> = ({
  open,
  onOpenChange,
  categoriaId,
  categoriaNome,
  itemToEdit,
}) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const form = useForm<DiretrizMaterialConsumoItemForm>({
    resolver: zodResolver(materialConsumoItemSchema),
    defaultValues: {
      descricao_item: "",
      preco_unitario: 0,
      numero_pregao: "",
      uasg_referencia: "",
      ativo: true,
    },
  });
  
  // Estado para o input monetário
  const [rawPreco, setRawPreco] = useState("000");

  useEffect(() => {
    if (itemToEdit) {
      form.reset({
        descricao_item: itemToEdit.descricao_item,
        preco_unitario: Number(itemToEdit.preco_unitario),
        numero_pregao: itemToEdit.numero_pregao || "",
        uasg_referencia: itemToEdit.uasg_referencia || "",
        ativo: itemToEdit.ativo,
      });
      setRawPreco(numberToRawDigits(Number(itemToEdit.preco_unitario)));
    } else {
      form.reset({
        descricao_item: "",
        preco_unitario: 0,
        numero_pregao: "",
        uasg_referencia: "",
        ativo: true,
      });
      setRawPreco("000");
    }
  }, [itemToEdit, form, open]);
  
  const handleCurrencyChange = (rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    setRawPreco(digits);
    form.setValue("preco_unitario", numericValue, { shouldValidate: true });
  };

  const onSubmit = async (data: DiretrizMaterialConsumoItemForm) => {
    if (!user) {
        toast.error("Usuário não autenticado.");
        return;
    }
    
    try {
        setLoading(true);
        
        const dbData: TablesInsert<'diretrizes_material_consumo_itens'> = {
            user_id: user.id,
            categoria_id: categoriaId,
            descricao_item: data.descricao_item,
            preco_unitario: data.preco_unitario,
            numero_pregao: data.numero_pregao || null,
            uasg_referencia: data.uasg_referencia || null,
            ativo: data.ativo,
        };

        if (itemToEdit?.id) {
            const { error } = await supabase
                .from('diretrizes_material_consumo_itens')
                .update(dbData as TablesUpdate<'diretrizes_material_consumo_itens'>)
                .eq('id', itemToEdit.id);
            if (error) throw error;
            toast.success("Item de Material de Consumo atualizado!");
        } else {
            const { error } = await supabase
                .from('diretrizes_material_consumo_itens')
                .insert([dbData]);
            if (error) throw error;
            toast.success("Novo Item de Material de Consumo cadastrado!");
        }
        
        // Invalida a query de itens para forçar a atualização da lista na categoria
        queryClient.invalidateQueries({ queryKey: ["materialConsumoItens", categoriaId] });
        onOpenChange(false);
        
    } catch (error: any) {
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{itemToEdit ? "Editar Item" : "Novo Item"} de Material de Consumo</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm text-muted-foreground">Categoria: <span className="font-semibold">{categoriaNome}</span></p>
            
            <FormField
              control={form.control}
              name="descricao_item"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Item (incluir unidade)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Caneta Esferográfica Azul (UN)" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preco_unitario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço Unitário (R$)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                        rawDigits={rawPreco}
                        onChange={handleCurrencyChange}
                        placeholder="0,00"
                        disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero_pregao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pregão</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 01/2024" {...field} disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="uasg_referencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UASG</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 160001" {...field} disabled={loading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialConsumoItemFormDialog;
