import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
    DiretrizConcessionaria,
    DiretrizConcessionariaForm,
    diretrizConcessionariaSchema,
    CATEGORIAS_CONCESSIONARIA,
    CategoriaConcessionaria
} from "@/types/diretrizesConcessionaria";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";

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
    const defaultValues: DiretrizConcessionariaForm = {
        ano_referencia: selectedYear,
        categoria: initialCategory,
        nome_concessionaria: "",
        consumo_pessoa_dia: 0,
        fonte_consumo: "",
        custo_unitario: 0,
        fonte_custo: "",
        unidade_custo: initialCategory === 'Água/Esgoto' ? 'm³' : 'kWh',
    };

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<DiretrizConcessionariaForm>({
        resolver: zodResolver(diretrizConcessionariaSchema),
        defaultValues: defaultValues,
    });
    
    const watchedCategoria = watch('categoria');
    const watchedCustoUnitario = watch('custo_unitario');
    const watchedConsumoPessoaDia = watch('consumo_pessoa_dia');

    useEffect(() => {
        if (open) {
            if (diretrizToEdit) {
                reset({
                    ...diretrizToEdit,
                    ano_referencia: diretrizToEdit.ano_referencia,
                    consumo_pessoa_dia: Number(diretrizToEdit.consumo_pessoa_dia),
                    custo_unitario: Number(diretrizToEdit.custo_unitario),
                });
            } else {
                // Ao criar novo, resetamos para os valores padrão, mas definimos consumo como 0 para que o input apareça vazio
                reset({
                    ...defaultValues,
                    categoria: initialCategory,
                    unidade_custo: initialCategory === 'Água/Esgoto' ? 'm³' : 'kWh',
                    consumo_pessoa_dia: 0, // Mantemos 0 no estado do hook form, mas o input será renderizado como vazio
                });
            }
        }
    }, [open, diretrizToEdit, reset, selectedYear, initialCategory]);
    
    // Efeito para sincronizar a unidade de custo com a categoria
    useEffect(() => {
        if (watchedCategoria === 'Água/Esgoto') {
            setValue('unidade_custo', 'm³');
        } else if (watchedCategoria === 'Energia Elétrica') {
            setValue('unidade_custo', 'kWh');
        }
    }, [watchedCategoria, setValue]);

    const onSubmit = async (data: DiretrizConcessionariaForm) => {
        try {
            const dataToSave = {
                ...data,
                id: diretrizToEdit?.id,
                user_id: undefined, // Supabase handles user_id insertion
                consumo_pessoa_dia: Number(data.consumo_pessoa_dia),
                custo_unitario: Number(data.custo_unitario),
            };
            await onSave(dataToSave);
            onOpenChange(false);
        } catch (e) {
            toast.error("Erro ao salvar a diretriz.");
        }
    };
    
    const handleCurrencyChange = (value: string) => {
        const { numericValue } = formatCurrencyInput(value);
        setValue('custo_unitario', numericValue, { shouldValidate: true });
    };
    
    const rawCustoUnitario = numberToRawDigits(watchedCustoUnitario);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{diretrizToEdit ? "Editar Diretriz" : "Nova Diretriz"} de Concessionária</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoria</Label>
                            <Select
                                value={watchedCategoria}
                                onValueChange={(value) => setValue('categoria', value as CategoriaConcessionaria, { shouldValidate: true })}
                                disabled={!!diretrizToEdit} // Não permite mudar a categoria ao editar
                            >
                                <SelectTrigger id="categoria">
                                    <SelectValue placeholder="Selecione a categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.categoria && <p className="text-xs text-red-500">{errors.categoria.message}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="nome_concessionaria">Nome da Concessionária</Label>
                            <Input
                                id="nome_concessionaria"
                                {...register("nome_concessionaria")}
                                placeholder="Ex: CEDAE, Light, Enel"
                            />
                            {errors.nome_concessionaria && <p className="text-xs text-red-500">{errors.nome_concessionaria.message}</p>}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="consumo_pessoa_dia">Consumo/pessoa/dia ({watchedCategoria === 'Água/Esgoto' ? 'm³' : 'kWh'})</Label>
                            <Input
                                id="consumo_pessoa_dia"
                                type="number"
                                step="0.01"
                                {...register("consumo_pessoa_dia", { valueAsNumber: true })}
                                placeholder="Ex: 0.2 (m³)"
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                // Renderiza como string vazia se for 0 e não estiver sendo editado
                                value={diretrizToEdit ? watchedConsumoPessoaDia : (watchedConsumoPessoaDia === 0 ? "" : watchedConsumoPessoaDia)}
                            />
                            {errors.consumo_pessoa_dia && <p className="text-xs text-red-500">{errors.consumo_pessoa_dia.message}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                            <CurrencyInput
                                rawDigits={rawCustoUnitario}
                                onChange={handleCurrencyChange}
                                placeholder="0,00"
                            />
                            {errors.custo_unitario && <p className="text-xs text-red-500">{errors.custo_unitario.message}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="unidade_custo">Unidade de Custo</Label>
                            <Input
                                id="unidade_custo"
                                value={watchedCategoria === 'Água/Esgoto' ? 'm3' : 'kWh'}
                                disabled
                                className="bg-muted/50"
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fonte_consumo">Fonte do Consumo (Documento)</Label>
                            <Input
                                id="fonte_consumo"
                                {...register("fonte_consumo")}
                                placeholder="Ex: Portaria X/2024"
                            />
                            {errors.fonte_consumo && <p className="text-xs text-red-500">{errors.fonte_consumo.message}</p>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="fonte_custo">Fonte do Custo (Documento)</Label>
                            <Input
                                id="fonte_custo"
                                {...register("fonte_custo")}
                                placeholder="Ex: Contrato Y/2023"
                            />
                            {errors.fonte_custo && <p className="text-xs text-red-500">{errors.fonte_custo.message}</p>}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Diretriz
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizFormDialog;