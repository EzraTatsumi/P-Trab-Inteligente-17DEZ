import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, XCircle, Droplet, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { diretrizConcessionariaSchema } from "@/lib/validationSchemas";
import { 
    DiretrizConcessionaria, 
    DiretrizConcessionariaForm, 
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
    const isEditing = !!diretrizToEdit;
    
    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<DiretrizConcessionariaForm>({
        resolver: zodResolver(diretrizConcessionariaSchema.omit({ ano_referencia: true })),
        defaultValues: {
            categoria: initialCategory,
            nome_concessionaria: "",
            consumo_pessoa_dia: 0,
            custo_unitario: 0,
            unidade_custo: "",
            fonte_consumo: "",
            fonte_custo: "",
        }
    });
    
    // Estado para inputs monetários brutos
    const [rawCustoUnitario, setRawCustoUnitario] = useState<string>("");

    useEffect(() => {
        if (open) {
            if (diretrizToEdit) {
                // Modo Edição
                setValue('categoria', diretrizToEdit.categoria as CategoriaConcessionaria);
                setValue('nome_concessionaria', diretrizToEdit.nome_concessionaria);
                setValue('consumo_pessoa_dia', Number(diretrizToEdit.consumo_pessoa_dia));
                setValue('custo_unitario', Number(diretrizToEdit.custo_unitario));
                setValue('unidade_custo', diretrizToEdit.unidade_custo);
                setValue('fonte_consumo', diretrizToEdit.fonte_consumo || "");
                setValue('fonte_custo', diretrizToEdit.fonte_custo || "");
                
                setRawCustoUnitario(numberToRawDigits(Number(diretrizToEdit.custo_unitario)));
            } else {
                // Modo Novo
                reset({
                    categoria: initialCategory,
                    nome_concessionaria: "",
                    consumo_pessoa_dia: 0,
                    custo_unitario: 0,
                    unidade_custo: initialCategory === 'Água/Esgoto' ? 'm³' : 'kWh',
                    fonte_consumo: "",
                    fonte_custo: "",
                });
                setRawCustoUnitario("");
            }
        }
    }, [open, diretrizToEdit, reset, setValue, initialCategory]);
    
    const watchedCategory = watch('categoria');
    
    // Atualiza a unidade de custo quando a categoria muda (apenas se não estiver editando)
    useEffect(() => {
        if (!isEditing) {
            setValue('unidade_custo', watchedCategory === 'Água/Esgoto' ? 'm³' : 'kWh');
        }
    }, [watchedCategory, setValue, isEditing]);

    const onSubmit = async (data: DiretrizConcessionariaForm) => {
        const dataToSave = {
            ...data,
            id: diretrizToEdit?.id,
            ano_referencia: selectedYear,
            // Garante que o consumo seja um número (Zod já validou, mas para segurança)
            consumo_pessoa_dia: Number(data.consumo_pessoa_dia),
            custo_unitario: Number(data.custo_unitario),
        };
        await onSave(dataToSave);
    };
    
    const handleCurrencyChange = (rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setRawCustoUnitario(digits);
        setValue('custo_unitario', numericValue, { shouldValidate: true });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {watchedCategory === 'Água/Esgoto' ? <Droplet className="h-5 w-5 text-blue-500" /> : <Zap className="h-5 w-5 text-yellow-600" />}
                        {isEditing ? "Editar Diretriz" : "Nova Diretriz"} de {watchedCategory}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    
                    {/* Categoria */}
                    <div className="space-y-2">
                        <Label htmlFor="categoria">Categoria *</Label>
                        <Select
                            value={watchedCategory}
                            onValueChange={(value) => setValue('categoria', value as CategoriaConcessionaria, { shouldValidate: true })}
                            disabled={isEditing}
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
                        {errors.categoria && <p className="text-sm text-red-500">{errors.categoria.message}</p>}
                    </div>
                    
                    {/* Nome da Concessionária */}
                    <div className="space-y-2">
                        <Label htmlFor="nome_concessionaria">Nome da Concessionária *</Label>
                        <Input
                            id="nome_concessionaria"
                            placeholder="Ex: CEB, CAESB, Águas do Rio"
                            {...register("nome_concessionaria")}
                        />
                        {errors.nome_concessionaria && <p className="text-sm text-red-500">{errors.nome_concessionaria.message}</p>}
                    </div>
                    
                    {/* Consumo e Unidade */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="consumo_pessoa_dia">Consumo por Pessoa/Dia ({watchedCategory === 'Água/Esgoto' ? 'm³' : 'kWh'}) *</Label>
                            <Input
                                id="consumo_pessoa_dia"
                                type="number"
                                step="0.01"
                                placeholder="Ex: 0.2 (m³/dia) ou 1.5 (kWh/dia)"
                                {...register("consumo_pessoa_dia", { valueAsNumber: true })}
                            />
                            {errors.consumo_pessoa_dia && <p className="text-sm text-red-500">{errors.consumo_pessoa_dia.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unidade_custo">Unidade de Custo *</Label>
                            <Input
                                id="unidade_custo"
                                placeholder="Ex: m³ ou kWh"
                                {...register("unidade_custo")}
                            />
                            {errors.unidade_custo && <p className="text-sm text-red-500">{errors.unidade_custo.message}</p>}
                        </div>
                    </div>
                    
                    {/* Custo Unitário */}
                    <div className="space-y-2">
                        <Label htmlFor="custo_unitario">Custo Unitário (R$/{watch('unidade_custo')}) *</Label>
                        <CurrencyInput
                            rawDigits={rawCustoUnitario} // Corrected prop name
                            onChange={handleCurrencyChange}
                            placeholder="Ex: 5,50"
                        />
                        {errors.custo_unitario && <p className="text-sm text-red-500">{errors.custo_unitario.message}</p>}
                    </div>
                    
                    {/* Fontes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fonte_consumo">Fonte do Consumo (Opcional)</Label>
                            <Input
                                id="fonte_consumo"
                                placeholder="Ex: MOP 2024"
                                {...register("fonte_consumo")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fonte_custo">Fonte do Custo (Opcional)</Label>
                            <Input
                                id="fonte_custo"
                                placeholder="Ex: Contrato 01/2024"
                                {...register("fonte_custo")}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isEditing ? "Salvar Alterações" : "Cadastrar Diretriz"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizFormDialog;