import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Loader2, Plane, Bus, Ship, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyInput, numberToRawDigits, formatCurrency } from "@/lib/formatUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte, DiretrizPassagemForm } from "@/types/diretrizesPassagens";
import { DatePicker } from "@/components/DatePicker";
import { parseISO, formatISO } from 'date-fns';
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { formatCodug } from "@/lib/formatUtils";
import CurrencyInput from "@/components/CurrencyInput";

interface PassagemDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizPassagem | null;
    onSave: (data: DiretrizPassagemForm & { id?: string }) => Promise<void>;
    loading: boolean;
}

// Tipo interno para o formulário, usando Date | null para as datas
// FIX 1: Usamos Partial<DiretrizPassagem> para garantir que 'id' seja opcional, e depois Omit para remover os campos que estamos substituindo/tratando.
interface InternalPassagemForm extends Omit<Partial<DiretrizPassagem>, 'trechos' | 'data_inicio_vigencia' | 'data_fim_vigencia' | 'user_id' | 'created_at' | 'updated_at'> {
    id?: string;
    trechos: TrechoPassagem[];
    data_inicio_vigencia: Date | null;
    data_fim_vigencia: Date | null;
}

// Tipo interno para o formulário de trecho, incluindo o valor bruto
interface InternalTrechoForm extends Omit<TrechoPassagem, 'id'> {
    rawValor: string;
    id?: string;
}

const defaultTrechoForm: InternalTrechoForm = {
    origem: '',
    destino: '',
    valor: 0,
    rawValor: numberToRawDigits(0),
    tipo_transporte: 'AEREO', // Corrigido para AEREO
    is_ida_volta: false,
    quantidade_passagens: 1, // Adicionado
};

const PassagemDiretrizFormDialog: React.FC<PassagemDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const [passagemForm, setPassagemForm] = useState<InternalPassagemForm>(() => ({
        ano_referencia: selectedYear, // Garantido
        om_referencia: diretrizToEdit?.om_referencia || '',
        ug_referencia: diretrizToEdit?.ug_referencia || '',
        numero_pregao: diretrizToEdit?.numero_pregao || '',
        trechos: diretrizToEdit?.trechos || [],
        ativo: diretrizToEdit?.ativo ?? true, // Garantido
        data_inicio_vigencia: diretrizToEdit?.data_inicio_vigencia ? parseISO(diretrizToEdit.data_inicio_vigencia) : null,
        data_fim_vigencia: diretrizToEdit?.data_fim_vigencia ? parseISO(diretrizToEdit.data_fim_vigencia) : null,
        id: diretrizToEdit?.id,
    }));
    
    const [trechoForm, setTrechoForm] = useState<InternalTrechoForm>(defaultTrechoForm);
    const [editingTrechoId, setEditingTrechoId] = useState<string | null>(null);
    const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (open) {
            if (diretrizToEdit) {
                // Edição
                setPassagemForm({
                    ano_referencia: diretrizToEdit.ano_referencia,
                    om_referencia: diretrizToEdit.om_referencia,
                    ug_referencia: diretrizToEdit.ug_referencia,
                    numero_pregao: diretrizToEdit.numero_pregao || '',
                    trechos: diretrizToEdit.trechos,
                    ativo: diretrizToEdit.ativo,
                    id: diretrizToEdit.id,
                    // Conversão de string ISO para objeto Date
                    data_inicio_vigencia: diretrizToEdit.data_inicio_vigencia ? parseISO(diretrizToEdit.data_inicio_vigencia) : null,
                    data_fim_vigencia: diretrizToEdit.data_fim_vigencia ? parseISO(diretrizToEdit.data_fim_vigencia) : null,
                });
                setSelectedOmId('temp'); // Força a exibição da OM existente
            } else {
                // Novo
                setPassagemForm({
                    ano_referencia: selectedYear,
                    om_referencia: '',
                    ug_referencia: '',
                    numero_pregao: '',
                    trechos: [],
                    ativo: true,
                    data_inicio_vigencia: null,
                    data_fim_vigencia: null,
                });
                setSelectedOmId(undefined);
            }
            setTrechoForm(defaultTrechoForm);
            setEditingTrechoId(null);
        }
    }, [open, diretrizToEdit, selectedYear]);

    const handleOmChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmId(omData.id);
            setPassagemForm(prev => ({
                ...prev,
                om_referencia: omData.nome_om,
                ug_referencia: omData.codug_om,
            }));
        } else {
            setSelectedOmId(undefined);
            setPassagemForm(prev => ({
                ...prev,
                om_referencia: '',
                ug_referencia: '',
            }));
        }
    };

    const handleTrechoFormChange = (field: keyof InternalTrechoForm, value: any) => {
        setTrechoForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCurrencyChange = (rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setTrechoForm(prev => ({ ...prev, valor: numericValue, rawValor: digits }));
    };

    const handleAddOrUpdateTrecho = () => {
        if (!trechoForm.origem || !trechoForm.destino || trechoForm.valor <= 0 || trechoForm.quantidade_passagens <= 0) {
            toast.error("Preencha todos os campos do trecho (Origem, Destino, Valor e Quantidade).");
            return;
        }
        
        if (trechoForm.origem === trechoForm.destino) {
            toast.error("Origem e Destino não podem ser iguais.");
            return;
        }

        const newTrecho: TrechoPassagem = {
            id: editingTrechoId || Math.random().toString(36).substring(2, 9),
            origem: trechoForm.origem,
            destino: trechoForm.destino,
            valor: trechoForm.valor,
            tipo_transporte: trechoForm.tipo_transporte,
            is_ida_volta: trechoForm.is_ida_volta,
            quantidade_passagens: trechoForm.quantidade_passagens, // Adicionado
        };

        setPassagemForm(prev => {
            let updatedTrechos;
            if (editingTrechoId) {
                updatedTrechos = prev.trechos.map(t => t.id === editingTrechoId ? newTrecho : t);
            } else {
                updatedTrechos = [...prev.trechos, newTrecho];
            }
            return { ...prev, trechos: updatedTrechos };
        });

        setTrechoForm(defaultTrechoForm);
        setEditingTrechoId(null);
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
            quantidade_passagens: trecho.quantidade_passagens, // Adicionado
        });
    };

    const handleRemoveTrecho = (id: string) => {
        setPassagemForm(prev => ({
            ...prev,
            trechos: prev.trechos.filter(t => t.id !== id),
        }));
        if (editingTrechoId === id) {
            setTrechoForm(defaultTrechoForm);
            setEditingTrechoId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!passagemForm.om_referencia || !passagemForm.ug_referencia) {
            toast.error("Selecione a OM de referência.");
            return;
        }
        
        if (passagemForm.trechos.length === 0) {
            toast.error("Adicione pelo menos um trecho de passagem.");
            return;
        }
        
        if (passagemForm.data_inicio_vigencia && passagemForm.data_fim_vigencia && passagemForm.data_inicio_vigencia > passagemForm.data_fim_vigencia) {
            toast.error("A data de início da vigência não pode ser posterior à data final.");
            return;
        }

        // Conversão de Date para string ISO antes de salvar
        const dataToSave: DiretrizPassagemForm & { id?: string } = {
            ...passagemForm,
            ano_referencia: selectedYear,
            data_inicio_vigencia: passagemForm.data_inicio_vigencia ? formatISO(passagemForm.data_inicio_vigencia, { representation: 'date' }) : null,
            data_fim_vigencia: passagemForm.data_fim_vigencia ? formatISO(passagemForm.data_fim_vigencia, { representation: 'date' }) : null,
        };

        await onSave(dataToSave);
    };

    const getTransportIcon = (tipo: TipoTransporte) => {
        switch (tipo) {
            case 'AEREO': return <Plane className="h-4 w-4 text-blue-600" />;
            case 'TERRESTRE': return <Bus className="h-4 w-4 text-green-600" />;
            case 'FLUVIAL': return <Ship className="h-4 w-4 text-cyan-600" />;
            default: return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{diretrizToEdit ? "Editar Contrato de Passagens" : "Novo Contrato de Passagens"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    
                    {/* --- 1. Dados Principais --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="om_referencia">OM de Referência (Contratante) *</Label>
                            <OmSelector
                                selectedOmId={selectedOmId}
                                initialOmName={passagemForm.om_referencia}
                                onChange={handleOmChange}
                                placeholder="Selecione a OM..."
                                disabled={loading || !!diretrizToEdit}
                            />
                            {passagemForm.ug_referencia && (
                                <p className="text-xs text-muted-foreground">
                                    CODUG: {formatCodug(passagemForm.ug_referencia)}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="numero_pregao">Número do Pregão/Contrato</Label>
                            <Input
                                id="numero_pregao"
                                value={passagemForm.numero_pregao || ''}
                                onChange={(e) => setPassagemForm(prev => ({ ...prev, numero_pregao: e.target.value }))}
                                placeholder="Ex: 01/2024"
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="data_inicio_vigencia">Início da Vigência</Label>
                            <DatePicker
                                date={passagemForm.data_inicio_vigencia}
                                setDate={(date) => setPassagemForm(prev => ({ ...prev, data_inicio_vigencia: date || null }))}
                                placeholder="Selecione a data de início"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="data_fim_vigencia">Fim da Vigência</Label>
                            <DatePicker
                                date={passagemForm.data_fim_vigencia}
                                setDate={(date) => setPassagemForm(prev => ({ ...prev, data_fim_vigencia: date || null }))}
                                placeholder="Selecione a data final"
                            />
                        </div>
                        <div className="flex items-end space-x-2">
                            <Checkbox
                                id="ativo"
                                checked={passagemForm.ativo}
                                onCheckedChange={(checked) => setPassagemForm(prev => ({ ...prev, ativo: !!checked }))}
                            />
                            <Label htmlFor="ativo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Contrato Ativo
                            </Label>
                        </div>
                    </div>

                    {/* --- 2. Cadastro de Trechos --- */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Cadastro de Trechos ({passagemForm.trechos.length})</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end p-4 border rounded-lg bg-muted/50">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="origem">Origem *</Label>
                                <Input
                                    id="origem"
                                    value={trechoForm.origem}
                                    onChange={(e) => handleTrechoFormChange('origem', e.target.value)}
                                    placeholder="Ex: Brasília"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="destino">Destino *</Label>
                                <Input
                                    id="destino"
                                    value={trechoForm.destino}
                                    onChange={(e) => handleTrechoFormChange('destino', e.target.value)}
                                    placeholder="Ex: Rio de Janeiro"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tipo_transporte">Transporte *</Label>
                                <Select
                                    value={trechoForm.tipo_transporte}
                                    onValueChange={(value: TipoTransporte) => handleTrechoFormChange('tipo_transporte', value)}
                                >
                                    <SelectTrigger id="tipo_transporte">
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AEREO">Aéreo</SelectItem>
                                        <SelectItem value="TERRESTRE">Terrestre</SelectItem>
                                        <SelectItem value="FLUVIAL">Fluvial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quantidade_passagens">Qtd Passagens *</Label>
                                <Input
                                    id="quantidade_passagens"
                                    type="number"
                                    min="1"
                                    value={trechoForm.quantidade_passagens}
                                    onChange={(e) => handleTrechoFormChange('quantidade_passagens', parseInt(e.target.value) || 1)}
                                    placeholder="1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valor">Valor Unitário *</Label>
                                <CurrencyInput
                                    rawDigits={trechoForm.rawValor}
                                    onChange={handleCurrencyChange}
                                    placeholder="0,00"
                                />
                            </div>
                            
                            <div className="flex items-center space-x-2 md:col-span-1">
                                <Checkbox
                                    id="is_ida_volta"
                                    checked={trechoForm.is_ida_volta}
                                    onCheckedChange={(checked) => handleTrechoFormChange('is_ida_volta', !!checked)}
                                />
                                <Label htmlFor="is_ida_volta" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Ida/Volta
                                </Label>
                            </div>
                            
                            <Button 
                                type="button" 
                                onClick={handleAddOrUpdateTrecho} 
                                className="md:col-span-1"
                                disabled={loading}
                            >
                                {editingTrechoId ? "Atualizar" : "Adicionar"}
                            </Button>
                            {editingTrechoId && (
                                <Button 
                                    type="button" 
                                    onClick={() => { setTrechoForm(defaultTrechoForm); setEditingTrechoId(null); }} 
                                    variant="outline"
                                    size="icon"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Lista de Trechos */}
                        {passagemForm.trechos.length > 0 && (
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                                {passagemForm.trechos.map((trecho) => (
                                    <div key={trecho.id} className="flex items-center justify-between text-sm p-2 bg-background rounded-md shadow-sm border">
                                        <div className="flex items-center gap-3 font-medium">
                                            {getTransportIcon(trecho.tipo_transporte)}
                                            <span>{trecho.origem} &rarr; {trecho.destino}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <span className="text-xs text-muted-foreground">
                                                {trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'} ({trecho.quantidade_passagens}x)
                                            </span>
                                            <span className="font-bold text-primary">
                                                {formatCurrency(trecho.valor)}
                                            </span>
                                            <Button variant="ghost" size="icon" onClick={() => handleEditTrecho(trecho)}>
                                                <Plane className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTrecho(trecho.id)} className="text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {diretrizToEdit ? "Atualizar Contrato" : "Cadastrar Contrato"}
                        </Button>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={loading}>
                                Cancelar
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemDiretrizFormDialog;