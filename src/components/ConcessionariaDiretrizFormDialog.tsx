import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { diretrizConcessionariaSchema } from "@/lib/validationSchemas";
import CurrencyInput from "@/components/CurrencyInput";
import { numberToRawDigits } from "@/lib/formatUtils";
import { 
    DiretrizConcessionaria, 
    DiretrizConcessionariaForm, 
    CATEGORIAS_CONCESSIONARIA,
    CategoriaConcessionaria,
    UNIDADES_CUSTO_CONCESSIONARIA, // Adicionado
} from "@/types/diretrizesConcessionaria";

interface ConcessionariaDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizConcessionaria | null;
    onSave: (data: DiretrizConcessionariaForm & { id?: string }) => Promise<void>;
    loading: boolean;
    initialCategory: CategoriaConcessionaria;
}

const ConcessionariaDiretrizFormDialog: React.FC<ConcessionariaDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
    initialCategory,
}) => {
    const form = useForm<DiretrizConcessionariaForm>({
        resolver: zodResolver(diretrizConcessionariaSchema),
        defaultValues: {
            ano_referencia: selectedYear,
            categoria: initialCategory,
            nome_concessionaria: "",
            consumo_pessoa_dia: 0,
            fonte_consumo: "",
            custo_unitario: 0,
            fonte_custo: "",
            unidade_custo: initialCategory === "Água/Esgoto" ? "m3" : "kWh", // Define default based on category
        },
    });

    useEffect(() => {
        if (diretrizToEdit) {
            // Preenche o formulário com os dados da diretriz para edição
            form.reset({
                ano_referencia: diretrizToEdit.ano_referencia,
                categoria: diretrizToEdit.categoria,
                nome_concessionaria: diretrizToEdit.nome_concessionaria,
                consumo_pessoa_dia: diretrizToEdit.consumo_pessoa_dia,
                fonte_consumo: diretrizToEdit.fonte_consumo || "",
                custo_unitario: diretrizToEdit.custo_unitario,
                fonte_custo: diretrizToEdit.fonte_custo || "",
                unidade_custo: diretrizToEdit.unidade_custo,
            });
        } else {
            // Reseta para valores padrão ao abrir para criação
            form.reset({
                ano_referencia: selectedYear,
                categoria: initialCategory,
                nome_concessionaria: "",
                consumo_pessoa_dia: 0,
                fonte_consumo: "",
                custo_unitario: 0,
                fonte_custo: "",
                unidade_custo: initialCategory === "Água/Esgoto" ? "m3" : "kWh",
            });
        }
    }, [diretrizToEdit, selectedYear, initialCategory, form]);

    const onSubmit = async (data: DiretrizConcessionariaForm) => {
        await onSave({ ...data, id: diretrizToEdit?.id });
        if (!loading) {
            onOpenChange(false);
        }
    };
    
    const currentCategory = form.watch('categoria');
    const currentUnit = currentCategory === "Água/Esgoto" ? "m3" : "kWh";
    
    // Atualiza a unidade de custo automaticamente quando a categoria muda
    useEffect(() => {
        form.setValue('unidade_custo', currentUnit);
    }, [currentUnit, form]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{diretrizToEdit ? "Editar Diretriz de Concessionária" : "Nova Diretriz de Concessionária"}</DialogTitle>
                    <DialogDescription>
                        Defina os parâmetros de consumo e custo para {diretrizToEdit ? diretrizToEdit.nome_concessionaria : "uma nova concessionária"}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        
                        <FormField
                            control={form.control}
                            name="categoria"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione a categoria" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="nome_concessionaria"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome da Concessionária</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: CEB, CAESB" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="consumo_pessoa_dia"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Consumo por Pessoa/Dia ({currentUnit})</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="Ex: 0.15 (m3) ou 1.5 (kWh)" 
                                                {...field} 
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="fonte_consumo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fonte do Consumo (Opcional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: Média Histórica OM" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="custo_unitario"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custo Unitário (R$/{currentUnit})</FormLabel>
                                        <FormControl>
                                            <CurrencyInput
                                                value={numberToRawDigits(field.value)}
                                                onChange={(digits) => field.onChange(parseFloat(digits) / 100)}
                                                placeholder="0,00"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <FormField
                                control={form.control}
                                name="fonte_custo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fonte do Custo (Opcional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: Contrato 01/2024" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        
                        {/* Campo oculto para unidade_custo, pois é derivado da categoria */}
                        <FormField
                            control={form.control}
                            name="unidade_custo"
                            render={({ field }) => (
                                <FormItem className="hidden">
                                    <FormLabel>Unidade de Custo</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Diretriz"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizFormDialog;