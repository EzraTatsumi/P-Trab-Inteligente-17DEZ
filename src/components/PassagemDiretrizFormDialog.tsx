import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { numberToRawDigits, formatCurrency, formatCodug } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Tipos redefinidos/ajustados para resolver erros de compilação:
export type TipoTransporte = 'AEREO' | 'TERRESTRE' | 'FLUVIAL';

export interface TrechoPassagem {
    id: string;
    origem: string;
    destino: string;
    valor: number;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
}

// Estrutura base da diretriz
export interface DiretrizPassagem {
    id: string;
    user_id: string;
    ano_referencia: number;
    om_referencia: string;
    ug_referencia: string;
    numero_pregao: string | null;
    trechos: TrechoPassagem[];
    ativo: boolean;
    created_at: string;
    updated_at: string;
    data_inicio_vigencia: string | null;
    data_fim_vigencia: string | null;
}

// Estrutura do formulário
export interface DiretrizPassagemForm extends Omit<DiretrizPassagem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'data_inicio_vigencia' | 'data_fim_vigencia'> {
    data_inicio_vigencia: Date | null;
    data_fim_vigencia: Date | null;
}

import CurrencyInput from "@/components/CurrencyInput";
import { DatePicker } from "@/components/DatePicker";
import { format, parseISO } from "date-fns";

interface PassagemDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizPassagem | null;
    onSave: (data: Partial<DiretrizPassagem> & { 
        ano_referencia: number, 
        om_referencia: string, 
        ug_referencia: string,
        data_inicio_vigencia?: string | null,
        data_fim_vigencia?: string | null,
    }) => Promise<void>;
    loading: boolean;
}

// Estado inicial para o formulário de Trecho
const initialTrechoForm: Omit<TrechoPassagem, 'id'> & { rawValor: string } = {
    origem: '',
    destino: '',
    valor: 0,
    rawValor: numberToRawDigits(0),
    tipo_transporte: 'AEREO',
    is_ida_volta: false,
};

// Definindo o tipo interno do formulário
type InternalPassagemForm = DiretrizPassagemForm & { 
    trechos: TrechoPassagem[], 
    id?: string,
    ano_referencia: number;
    ativo: boolean;
};

const PassagemDiretrizFormDialog: React.FC<PassagemDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    const { handleEnterToNextField } = useFormNavigation();

    const getInitialFormState = (editData: DiretrizPassagem | null): InternalPassagemForm => {
        if (editData) {
            return {
                om_referencia: editData.om_referencia,
                ug_referencia: editData.ug_referencia,
                numero_pregao: editData.numero_pregao || '',
                trechos: editData.trechos,
                id: editData.id,
                ano_referencia: editData.ano_referencia,
                ativo: editData.ativo,
                data_inicio_vigencia: editData.data_inicio_vigencia ? parseISO(editData.data_inicio_vigencia) : null,
                data_fim_vigencia: editData.data_fim_vigencia ? parseISO(editData.data_fim_vigencia) : null,
            };
        }
        
        return { 
            om_referencia: '', 
            ug_referencia: '', 
            numero_pregao: '', 
            trechos: [],
            ano_referencia: selectedYear,
            ativo: true,
            data_inicio_vigencia: null,
            data_fim_vigencia: null,
        };
    };

    const [passagemForm, setPassagemForm] = useState<InternalPassagemForm>(() => getInitialFormState(diretrizToEdit));
    
    const [selectedOmReferenciaId, setSelectedOmReferenciaId] = useState<string | undefined>(undefined);
    const [trechoForm, setTrechoForm] = useState<typeof initialTrechoForm>(initialTrechoForm);
    const [editingTrechoId, setEditingTrechoId] = useState<string | null>(null);

    useEffect(() => {
        setPassagemForm(getInitialFormState(diretrizToEdit));
        if (diretrizToEdit) {
            const om = oms?.find(o => o.nome_om === diretrizToEdit.om_referencia && o.codug_om === diretrizToEdit.ug_referencia);
            setSelectedOmReferenciaId(om?.id);
        } else {
            setSelectedOmReferenciaId(undefined);
        }
        setTrechoForm(initialTrechoForm);
        setEditingTrechoId(null);
    }, [diretrizToEdit, oms, open, selectedYear]);

    const handleOmReferenciaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmReferenciaId(omData.id);
            setPassagemForm(prev => ({
                ...prev,
                om_referencia: omData.nome_om,
                ug_referencia: omData.codug_om,
            }));
        } else {
            setSelectedOmReferenciaId(undefined);
            setPassagemForm(prev => ({
                ...prev,
                om_referencia: "",
                ug_referencia: "",
            }));
        }
    };

    const handleTrechoCurrencyChange = (numericValue: number, digits: string) => {
        setTrechoForm(prev => ({
            ...prev,
            valor: numericValue,
            rawValor: digits,
        }));
    };

    const handleAddTrecho = () => {
        if (!trechoForm.origem || !trechoForm.destino || trechoForm.valor <= 0) {
            toast.error("Preencha Origem, Destino e Valor do Trecho.");
            return;
        }

        const newTrecho: TrechoPassagem = {
            id: editingTrechoId || Math.random().toString(36).substring(2, 9),
            origem: trechoForm.origem.toUpperCase(),
            destino: trechoForm.destino.toUpperCase(),
            valor: trechoForm.valor,
            tipo_transporte: trechoForm.tipo_transporte,
            is_ida_volta: trechoForm.is_ida_volta,
        };

        const updatedTrechos = editingTrechoId
            ? passagemForm.trechos.map(t => t.id === editingTrechoId ? newTrecho : t)
            : [...passagemForm.trechos, newTrecho];

        setPassagemForm(prev => ({ ...prev, trechos: updatedTrechos }));

        setEditingTrechoId(null);
        setTrechoForm(initialTrechoForm);
    };

    const handleEditTrecho = (trecho: TrechoPassagem) => {
        setEditingTrechoId(trecho.id);
        setTrechoForm({
            origem: trecho.origem,
            destino: trecho.destino,
            valor: trecho.valor,
            rawValor: numberToRawDigits(trecho.valor),
            tipo_transporte: trecho.tipo_transporte,
            is_ida_volta: trecho.is_ida_volta,
        });
    };

    const handleDeleteTrecho = (trechoId: string) => {
        const updatedTrechos = passagemForm.trechos.filter(t => t.id !== trechoId);
        setPassagemForm(prev => ({ ...prev, trechos: updatedTrechos }));
    };

    const handleSave = async () => {
        if (!passagemForm.om_referencia || !passagemForm.ug_referencia) {
            toast.error("Selecione a OM de Referência.");
            return;
        }
        
        if (passagemForm.trechos.length === 0) {
            toast.error("Adicione pelo menos um trecho ao contrato.");
            return;
        }
        
        if (passagemForm.data_inicio_vigencia && passagemForm.data_fim_vigencia && passagemForm.data_inicio_vigencia > passagemForm.data_fim_vigencia) {
            toast.error("A data de início da vigência não pode ser posterior à data de fim.");
            return;
        }

        const dataToSave = {
            ...passagemForm,
            ano_referencia: selectedYear,
            id: passagemForm.id,
            data_inicio_vigencia: passagemForm.data_inicio_vigencia ? format(passagemForm.data_inicio_vigencia, 'yyyy-MM-dd') : null,
            data_fim_vigencia: passagemForm.data_fim_vigencia ? format(passagemForm.data_fim_vigencia, 'yyyy-MM-dd') : null,
        };

        await onSave(dataToSave);
        onOpenChange(false);
    };

    const isEditingContract = !!passagemForm.id;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditingContract ? `Editar Contrato de Passagens: ${passagemForm.om_referencia}` : "Novo Contrato de Passagens"}
                    </DialogTitle>
                    <DialogDescription>
                        Cadastre a OM de referência, o número do pregão, a vigência e os trechos de custo associados a este contrato.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Dados do Contrato */}
                    <Card className="p-4">
                        <CardTitle className="text-base mb-4">
                            Dados do Contrato
                        </CardTitle>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="om_referencia">OM de Referência do Contrato *</Label>
                                <OmSelector
                                    selectedOmId={selectedOmReferenciaId}
                                    onChange={handleOmReferenciaChange}
                                    placeholder="Selecione a OM"
                                    disabled={isEditingContract || loading || isLoadingOms}
                                    initialOmName={isEditingContract ? passagemForm.om_referencia : undefined}
                                    initialOmUg={isEditingContract ? passagemForm.ug_referencia : undefined}
                                />
                                <p className="text-xs text-muted-foreground">
                                    UG: {formatCodug(passagemForm.ug_referencia)}
                                </p>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="numero_pregao">Número do Pregão/Contrato</Label>
                                <Input
                                    id="numero_pregao"
                                    value={passagemForm.numero_pregao}
                                    onChange={(e) => setPassagemForm({ ...passagemForm, numero_pregao: e.target.value })}
                                    placeholder="Ex: Pregão Eletrônico Nº 01/2024"
                                    disabled={loading}
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="data_inicio_vigencia">Início da Vigência</Label>
                                <DatePicker
                                    id="data_inicio_vigencia"
                                    date={passagemForm.data_inicio_vigencia}
                                    setDate={(date) => setPassagemForm(prev => ({ ...prev, data_inicio_vigencia: date || null }))}
                                    placeholder="Selecione a data de início"
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="data_fim_vigencia">Fim da Vigência</Label>
                                <DatePicker
                                    id="data_fim_vigencia"
                                    date={passagemForm.data_fim_vigencia}
                                    setDate={(date) => setPassagemForm(prev => ({ ...prev, data_fim_vigencia: date || null }))}
                                    placeholder="Selecione a data final"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Gerenciamento de Trechos */}
                    <Card className="p-4 space-y-4">
                        <CardTitle className="text-base font-semibold">
                            {editingTrechoId ? "Editar Trecho" : "Adicionar Novo Trecho"}
                        </CardTitle>
                        
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 border p-3 rounded-lg bg-muted/50">
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="trecho-origem">Origem *</Label>
                                <Input
                                    id="trecho-origem"
                                    value={trechoForm.origem}
                                    onChange={(e) => setTrechoForm({ ...trechoForm, origem: e.target.value })}
                                    placeholder="Ex: BSB"
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="trecho-destino">Destino *</Label>
                                <Input
                                    id="trecho-destino"
                                    value={trechoForm.destino}
                                    onChange={(e) => setTrechoForm({ ...trechoForm, destino: e.target.value })}
                                    placeholder="Ex: MAO"
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="trecho-valor">Valor (R$) *</Label>
                                <CurrencyInput
                                    id="trecho-valor"
                                    rawDigits={trechoForm.rawValor}
                                    onChange={handleTrechoCurrencyChange}
                                    placeholder="0,00"
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="trecho-tipo">Tipo *</Label>
                                <Select
                                    value={trechoForm.tipo_transporte}
                                    onValueChange={(value) => setTrechoForm({ ...trechoForm, tipo_transporte: value as TipoTransporte })}
                                >
                                    <SelectTrigger id="trecho-tipo">
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AEREO">Aéreo</SelectItem>
                                        <SelectItem value="TERRESTRE">Terrestre</SelectItem>
                                        <SelectItem value="FLUVIAL">Fluvial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-1 flex items-center pt-6">
                                <Switch
                                    id="trecho-ida-volta"
                                    checked={trechoForm.is_ida_volta}
                                    onCheckedChange={(checked) => setTrechoForm({ ...trechoForm, is_ida_volta: checked })}
                                />
                                <Label htmlFor="trecho-ida-volta" className="ml-2 text-sm font-medium cursor-pointer whitespace-nowrap">
                                    {trechoForm.is_ida_volta ? "Ida e Volta" : "Somente Ida"}
                                </Label>
                            </div>
                            <div className="space-y-2 col-span-1 flex flex-col justify-end">
                                <Button 
                                    type="button" 
                                    onClick={handleAddTrecho}
                                    disabled={!trechoForm.origem || !trechoForm.destino || trechoForm.valor <= 0}
                                >
                                    {editingTrechoId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingTrechoId ? "Atualizar" : "Adicionar"}
                                </Button>
                            </div>
                        </div>
                        
                        {passagemForm.trechos.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Trecho</TableHead>
                                        <TableHead className="text-center">Tipo</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-center">Modalidade</TableHead>
                                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {passagemForm.trechos.map(trecho => (
                                        <TableRow key={trecho.id}>
                                            <TableCell className="font-medium">{trecho.origem} &rarr; {trecho.destino}</TableCell>
                                            <TableCell className="text-center">
                                                {trecho.tipo_transporte === 'AEREO' ? 'AÉREO' : trecho.tipo_transporte}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(trecho.valor)}</TableCell>
                                            <TableCell className="text-center">
                                                {trecho.is_ida_volta ? "Ida e Volta" : "Somente Ida"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditTrecho(trecho)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTrecho(trecho.id)} className="text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">Nenhum trecho cadastrado. Adicione trechos acima.</p>
                        )}
                    </Card>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                        type="button" 
                        onClick={handleSave}
                        disabled={loading || !passagemForm.om_referencia || !passagemForm.ug_referencia || passagemForm.trechos.length === 0}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEditingContract ? "Salvar Alterações" : "Cadastrar Contrato"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemDiretrizFormDialog;