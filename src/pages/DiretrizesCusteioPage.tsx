import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// Tipos para as tabelas de diretrizes
import { Tables } from "@/integrations/supabase/types";
type DiretrizCusteio = Tables<'diretrizes_custeio'>;
type DiretrizEquipamento = Tables<'diretrizes_equipamentos_classe_iii'>;
type DiretrizClasseII = Tables<'diretrizes_classe_ii'>;

// Tipos auxiliares para o formulário
type CombustivelTipo = 'GAS' | 'OD';
type UnidadeTipo = 'L/h' | 'km/L';
type CategoriaClasseII = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

interface EquipamentoForm extends Omit<DiretrizEquipamento, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ano_referencia'> {
    id?: string;
    ano_referencia?: number;
}

interface ClasseIIForm extends Omit<DiretrizClasseII, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'ano_referencia'> {
    id?: string;
    ano_referencia?: number;
    valor_mnt_dia_input: string;
}

const initialEquipamento: EquipamentoForm = {
    nome_equipamento: "",
    tipo_equipamento: "Viatura",
    tipo_combustivel: "OD",
    consumo: 0,
    unidade: "km/L",
    ativo: true,
};

const initialClasseII: ClasseIIForm = {
    categoria: "Equipamento Individual",
    item: "",
    valor_mnt_dia: 0,
    valor_mnt_dia_input: "",
    ativo: true,
};

export default function DiretrizesCusteioPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [diretrizCusteio, setDiretrizCusteio] = useState<DiretrizCusteio | null>(null);
    const [anoReferencia, setAnoReferencia] = useState<number>(new Date().getFullYear());
    const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
    const [isNewYear, setIsNewYear] = useState(false);

    // Classe I
    const [inputQS, setInputQS] = useState("9,00");
    const [inputQR, setInputQR] = useState("6,00");

    // Classe III - Equipamentos
    const [equipamentosConfig, setEquipamentosConfig] = useState<EquipamentoForm[]>([]);
    const [equipamentoTemp, setEquipamentoTemp] = useState<EquipamentoForm>(initialEquipamento);
    const [editingEquipamentoId, setEditingEquipamentoId] = useState<string | null>(null);
    const [inputConsumoEquipamento, setInputConsumoEquipamento] = useState("");

    // Classe II - Itens
    const [classeIIConfig, setClasseIIConfig] = useState<ClasseIIForm[]>([]);
    const [classeIITemp, setClasseIITemp] = useState<ClasseIIForm>(initialClasseII);
    const [editingClasseIIId, setEditingClasseIIId] = useState<string | null>(null);

    const [selectedTab, setSelectedTab] = useState('custeio');

    useEffect(() => {
        if (user) {
            loadAnosDisponiveis();
        }
    }, [user]);

    useEffect(() => {
        if (user && anoReferencia) {
            loadDiretrizes(anoReferencia);
        }
    }, [user, anoReferencia]);

    const loadAnosDisponiveis = async () => {
        setLoading(true);
        try {
            const { data: anosCusteio, error: errCusteio } = await supabase
                .from('diretrizes_custeio')
                .select('ano_referencia')
                .eq('user_id', user!.id);
            
            if (errCusteio) throw errCusteio;

            const { data: anosEquipamentos, error: errEquipamentos } = await supabase
                .from('diretrizes_equipamentos_classe_iii')
                .select('ano_referencia')
                .eq('user_id', user!.id);
            
            if (errEquipamentos) throw errEquipamentos;

            const allYears = [
                ...anosCusteio.map(a => a.ano_referencia),
                ...anosEquipamentos.map(a => a.ano_referencia)
            ];
            
            const uniqueYears = Array.from(new Set(allYears)).sort((a, b) => b - a);
            setAnosDisponiveis(uniqueYears);
            
            if (uniqueYears.length > 0 && !uniqueYears.includes(new Date().getFullYear())) {
                setAnoReferencia(uniqueYears[0]);
            } else if (uniqueYears.length === 0) {
                setAnoReferencia(new Date().getFullYear());
            }
            
        } catch (error) {
            console.error("Erro ao carregar anos disponíveis:", error);
            setAnosDisponiveis([new Date().getFullYear()]);
        } finally {
            setLoading(false);
        }
    };

    const loadDiretrizes = async (ano: number) => {
        setLoading(true);
        try {
            // 1. Diretriz Custeio (Classe I)
            const { data: custeioData, error: custeioError } = await supabase
                .from('diretrizes_custeio')
                .select('*')
                .eq('user_id', user!.id)
                .eq('ano_referencia', ano)
                .maybeSingle();

            if (custeioError) throw custeioError;

            if (custeioData) {
                setDiretrizCusteio(custeioData);
                setInputQS(formatNumberForInput(custeioData.classe_i_valor_qs, 2));
                setInputQR(formatNumberForInput(custeioData.classe_i_valor_qr, 2));
                setIsNewYear(false);
            } else {
                setDiretrizCusteio(null);
                setInputQS("9,00");
                setInputQR("6,00");
                setIsNewYear(true);
            }

            // 2. Diretrizes Classe III (Equipamentos)
            const { data: equipamentosData, error: equipamentosError } = await supabase
                .from('diretrizes_equipamentos_classe_iii')
                .select('*')
                .eq('user_id', user!.id)
                .eq('ano_referencia', ano)
                .order('tipo_equipamento', { ascending: true })
                .order('nome_equipamento', { ascending: true });

            if (equipamentosError) throw equipamentosError;
            setEquipamentosConfig((equipamentosData || []) as DiretrizEquipamento[]);
            
            // 3. Diretrizes Classe II (Itens)
            const { data: classeIIData, error: classeIIError } = await supabase
                .from('diretrizes_classe_ii')
                .select('*')
                .eq('user_id', user!.id)
                .eq('ano_referencia', ano)
                .order('categoria', { ascending: true })
                .order('item', { ascending: true });

            if (classeIIError) throw classeIIError;
            setClasseIIConfig((classeIIData || []).map(d => ({
                ...d,
                valor_mnt_dia_input: formatNumberForInput(d.valor_mnt_dia, 2)
            })) as ClasseIIForm[]);

        } catch (error) {
            console.error("Erro ao carregar diretrizes:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers de Classe I ---
    const handleSaveCusteio = async () => {
        if (!user) return;
        const valorQS = parseInputToNumber(inputQS);
        const valorQR = parseInputToNumber(inputQR);

        if (valorQS <= 0 || valorQR <= 0) {
            toast.error("Os valores de QS e QR devem ser positivos.");
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                user_id: user.id,
                ano_referencia: anoReferencia,
                classe_i_valor_qs: valorQS,
                classe_i_valor_qr: valorQR,
            };

            if (diretrizCusteio) {
                // Update
                const { error } = await supabase
                    .from('diretrizes_custeio')
                    .update(dataToSave)
                    .eq('id', diretrizCusteio.id);
                if (error) throw error;
                toast.success("Diretriz de Custeio atualizada!");
            } else {
                // Insert
                const { error } = await supabase
                    .from('diretrizes_custeio')
                    .insert([dataToSave]);
                if (error) throw error;
                toast.success("Diretriz de Custeio salva!");
            }
            loadDiretrizes(anoReferencia);
            loadAnosDisponiveis();
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers de Classe III (Equipamentos) ---
    const handleEquipamentoChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof EquipamentoForm) => {
        setEquipamentoTemp(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleConsumoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        let cleaned = rawValue.replace(/[^\d,.]/g, '');
        const parts = cleaned.split(',');
        if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
        cleaned = cleaned.replace(/\./g, '');
        
        setInputConsumoEquipamento(cleaned);
        setEquipamentoTemp(prev => ({ ...prev, consumo: parseInputToNumber(cleaned) }));
    };

    const handleConsumoBlur = (input: string) => {
        const numericValue = parseInputToNumber(input);
        const formattedDisplay = formatNumberForInput(numericValue, 2);
        setInputConsumoEquipamento(formattedDisplay);
        setEquipamentoTemp(prev => ({ ...prev, consumo: numericValue }));
    };

    const handleAddEquipamento = async () => {
        if (!user) return;
        if (!equipamentoTemp.nome_equipamento || equipamentoTemp.consumo <= 0) {
            toast.error("Preencha o nome e o consumo do equipamento.");
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                ...equipamentoTemp,
                user_id: user.id,
                ano_referencia: anoReferencia, // Garantido como number
                id: undefined,
            };
            
            if (editingEquipamentoId) {
                // Update
                const { error } = await supabase
                    .from('diretrizes_equipamentos_classe_iii')
                    .update(dataToSave)
                    .eq('id', editingEquipamentoId);
                if (error) throw error;
                toast.success("Equipamento atualizado!");
            } else {
                // Insert
                const { error } = await supabase
                    .from('diretrizes_equipamentos_classe_iii')
                    .insert([dataToSave as Tables<'diretrizes_equipamentos_classe_iii'>]);
                if (error) throw error;
                toast.success("Equipamento adicionado!");
            }
            
            resetEquipamentoForm();
            loadDiretrizes(anoReferencia);
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleEditEquipamento = (equipamento: EquipamentoForm) => {
        setEditingEquipamentoId(equipamento.id || null);
        setEquipamentoTemp(equipamento);
        setInputConsumoEquipamento(formatNumberForInput(equipamento.consumo, 2));
    };

    const handleRemoveEquipamento = async (id: string) => {
        if (!confirm("Deseja realmente remover este equipamento?")) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('diretrizes_equipamentos_classe_iii')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("Equipamento removido!");
            loadDiretrizes(anoReferencia);
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const resetEquipamentoForm = () => {
        setEquipamentoTemp(initialEquipamento);
        setInputConsumoEquipamento("");
        setEditingEquipamentoId(null);
    };

    // --- Handlers de Classe II (Itens) ---
    const handleClasseIIChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof ClasseIIForm) => {
        setClasseIITemp(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleValorMntDiaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        let cleaned = rawValue.replace(/[^\d,.]/g, '');
        const parts = cleaned.split(',');
        if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
        cleaned = cleaned.replace(/\./g, '');
        
        setClasseIITemp(prev => ({ ...prev, valor_mnt_dia_input: cleaned, valor_mnt_dia: parseInputToNumber(cleaned) }));
    };

    const handleValorMntDiaBlur = (input: string) => {
        const numericValue = parseInputToNumber(input);
        const formattedDisplay = formatNumberForInput(numericValue, 2);
        setClasseIITemp(prev => ({ ...prev, valor_mnt_dia_input: formattedDisplay, valor_mnt_dia: numericValue }));
    };

    const handleAddClasseII = async () => {
        if (!user) return;
        if (!classeIITemp.item || classeIITemp.valor_mnt_dia <= 0) {
            toast.error("Preencha o item e o valor de manutenção/dia.");
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                user_id: user.id,
                ano_referencia: anoReferencia, // Garantido como number
                categoria: classeIITemp.categoria,
                item: classeIITemp.item,
                valor_mnt_dia: classeIITemp.valor_mnt_dia,
                ativo: classeIITemp.ativo,
            };
            
            if (editingClasseIIId) {
                // Update
                const { error } = await supabase
                    .from('diretrizes_classe_ii')
                    .update(dataToSave)
                    .eq('id', editingClasseIIId);
                if (error) throw error;
                toast.success("Item de Classe II atualizado!");
            } else {
                // Insert
                const { error } = await supabase
                    .from('diretrizes_classe_ii')
                    .insert([dataToSave as Tables<'diretrizes_classe_ii'>]);
                if (error) throw error;
                toast.success("Item de Classe II adicionado!");
            }
            
            resetClasseIIForm();
            loadDiretrizes(anoReferencia);
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleEditClasseII = (item: ClasseIIForm) => {
        setEditingClasseIIId(item.id || null);
        setClasseIITemp(item);
    };

    const handleRemoveClasseII = async (id: string) => {
        if (!confirm("Deseja realmente remover este item?")) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('diretrizes_classe_ii')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("Item de Classe II removido!");
            loadDiretrizes(anoReferencia);
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const resetClasseIIForm = () => {
        setClasseIITemp(initialClasseII);
        setEditingClasseIIId(null);
    };

    const handleAnoChange = (newAno: number) => {
        setAnoReferencia(newAno);
        setEditingEquipamentoId(null);
        setEditingClasseIIId(null);
        setEquipamentoTemp(initialEquipamento);
        setClasseIITemp(initialClasseII);
    };

    const handleNewYear = () => {
        const nextYear = new Date().getFullYear() + 1;
        if (!anosDisponiveis.includes(nextYear)) {
            setAnosDisponiveis(prev => [...prev, nextYear].sort((a, b) => b - a));
        }
        handleAnoChange(nextYear);
    };

    const filteredEquipamentos = useMemo(() => {
        return equipamentosConfig.filter(e => e.tipo_equipamento === equipamentoTemp.tipo_equipamento);
    }, [equipamentosConfig, equipamentoTemp.tipo_equipamento]);

    const groupedClasseII = useMemo(() => {
        return classeIIConfig.reduce((acc, item) => {
            if (!acc[item.categoria]) {
                acc[item.categoria] = [];
            }
            acc[item.categoria].push(item);
            return acc;
        }, {} as Record<CategoriaClasseII, ClasseIIForm[]>);
    }, [classeIIConfig]);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="h-7 w-7 text-primary" />
                        Diretrizes de Custeio
                    </h1>
                    <Button variant="ghost" onClick={() => window.history.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-xl">Ano de Referência</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <div className="w-40">
                            <Select
                                value={String(anoReferencia)}
                                onValueChange={(value) => handleAnoChange(Number(value))}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o ano" />
                                </SelectTrigger>
                                <SelectContent>
                                    {anosDisponiveis.map(ano => (
                                        <SelectItem key={ano} value={String(ano)}>
                                            {ano}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleNewYear} variant="outline" disabled={loading}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Ano
                        </Button>
                        {isNewYear && (
                            <span className="text-sm text-red-500">
                                Configurando diretrizes para o ano {anoReferencia}.
                            </span>
                        )}
                    </CardContent>
                </Card>

                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="custeio">Classe I (Valores)</TabsTrigger>
                        <TabsTrigger value="classe_ii">Classe II (Itens)</TabsTrigger>
                        <TabsTrigger value="classe_iii">Classe III (Equipamentos)</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: CLASSE I */}
                    <TabsContent value="custeio" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Valores de Etapa (Classe I)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Valor da Etapa QS (Quantitativo de Subsistência) *</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={inputQS}
                                            onChange={(e) => handlePriceChange(e, setInputQS, 'classe_i_valor_qs')}
                                            onBlur={(e) => handlePriceBlur(e.target.value, setInputQS, 'classe_i_valor_qs')}
                                            placeholder="Ex: 9,00"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Valor da Etapa QR (Quantitativo de Rancho) *</Label>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={inputQR}
                                            onChange={(e) => handlePriceChange(e, setInputQR, 'classe_i_valor_qr')}
                                            onBlur={(e) => handlePriceBlur(e.target.value, setInputQR, 'classe_i_valor_qr')}
                                            placeholder="Ex: 6,00"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleSaveCusteio} disabled={loading}>
                                        {loading ? "Salvando..." : (diretrizCusteio ? "Atualizar Valores" : "Salvar Valores")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 2: CLASSE II */}
                    <TabsContent value="classe_ii" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Itens de Manutenção/Dia (Classe II)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Formulário de Adição/Edição */}
                                <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                                    <h4 className="font-semibold">{editingClasseIIId ? "Editar Item" : "Adicionar Novo Item"}</h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Categoria *</Label>
                                            <Select
                                                value={classeIITemp.categoria}
                                                onValueChange={(value) => setClasseIITemp(prev => ({ ...prev, categoria: value as CategoriaClasseII }))}
                                                disabled={loading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a categoria" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CATEGORIAS.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nome do Item *</Label>
                                            <Input
                                                value={classeIITemp.item}
                                                onChange={(e) => handleClasseIIChange(e, 'item')}
                                                placeholder="Ex: Capa de Chuva"
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Valor Mnt/Dia (R$) *</Label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={classeIITemp.valor_mnt_dia_input}
                                                onChange={handleValorMntDiaChange}
                                                onBlur={(e) => handleValorMntDiaBlur(e.target.value)}
                                                placeholder="Ex: 0,15"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="classeIIAtivo"
                                                checked={classeIITemp.ativo}
                                                onCheckedChange={(checked) => setClasseIITemp(prev => ({ ...prev, ativo: !!checked }))}
                                                disabled={loading}
                                            />
                                            <Label htmlFor="classeIIAtivo">Ativo</Label>
                                        </div>
                                        <div className="flex gap-2">
                                            {editingClasseIIId && (
                                                <Button variant="outline" onClick={resetClasseIIForm} disabled={loading}>
                                                    <XCircle className="h-4 w-4 mr-2" /> Cancelar
                                                </Button>
                                            )}
                                            <Button onClick={handleAddClasseII} disabled={loading || !classeIITemp.item || classeIITemp.valor_mnt_dia <= 0}>
                                                {loading ? "Salvando..." : (editingClasseIIId ? "Atualizar Item" : "Adicionar Item")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Itens */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold">Itens Cadastrados ({classeIIConfig.length})</h4>
                                    {Object.entries(groupedClasseII).map(([categoria, itens]) => (
                                        <div key={categoria} className="border rounded-lg p-3 space-y-2">
                                            <h5 className="font-bold text-sm text-primary">{categoria}</h5>
                                            {itens.map(item => (
                                                <div key={item.id} className={cn("flex justify-between items-center p-2 rounded-md", item.ativo ? "bg-background" : "bg-red-50/50 opacity-70")}>
                                                    <div className="flex-1">
                                                        <p className="font-medium">{item.item}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatCurrency(item.valor_mnt_dia)} / dia
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" onClick={() => handleEditClasseII(item)} disabled={loading}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => handleRemoveClasseII(item.id!)} disabled={loading}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* TAB 3: CLASSE III */}
                    <TabsContent value="classe_iii" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Consumo de Equipamentos (Classe III)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Formulário de Adição/Edição */}
                                <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                                    <h4 className="font-semibold">{editingEquipamentoId ? "Editar Equipamento" : "Adicionar Novo Equipamento"}</h4>
                                    <div className="grid md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <Label>Tipo *</Label>
                                            <Select
                                                value={equipamentoTemp.tipo_equipamento}
                                                onValueChange={(value) => setEquipamentoTemp(prev => ({ ...prev, tipo_equipamento: value as 'Viatura' | 'Gerador' | 'Engenharia' | 'Embarcacao' }))}
                                                disabled={loading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Viatura">Viatura</SelectItem>
                                                    <SelectItem value="Gerador">Gerador</SelectItem>
                                                    <SelectItem value="Engenharia">Engenharia</SelectItem>
                                                    <SelectItem value="Embarcacao">Embarcação</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nome/Modelo *</Label>
                                            <Input
                                                value={equipamentoTemp.nome_equipamento}
                                                onChange={(e) => handleEquipamentoChange(e, 'nome_equipamento')}
                                                placeholder="Ex: Viatura 5 Ton"
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Combustível *</Label>
                                            <Select
                                                value={equipamentoTemp.tipo_combustivel}
                                                onValueChange={(value) => setEquipamentoTemp(prev => ({ ...prev, tipo_combustivel: value as CombustivelTipo }))}
                                                disabled={loading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="OD">Óleo Diesel (OD)</SelectItem>
                                                    <SelectItem value="GAS">Gasolina (GAS)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Unidade *</Label>
                                            <Select
                                                value={equipamentoTemp.unidade}
                                                onValueChange={(value) => setEquipamentoTemp(prev => ({ ...prev, unidade: value as UnidadeTipo }))}
                                                disabled={loading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L/h">Litros/Hora (L/h)</SelectItem>
                                                    <SelectItem value="km/L">Km/Litro (km/L)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <Label>Consumo *</Label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={inputConsumoEquipamento}
                                                onChange={handleConsumoChange}
                                                onBlur={(e) => handleConsumoBlur(e.target.value)}
                                                placeholder="Ex: 2,5"
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-2 pt-6">
                                            <Checkbox
                                                id="equipamentoAtivo"
                                                checked={equipamentoTemp.ativo}
                                                onCheckedChange={(checked) => setEquipamentoTemp(prev => ({ ...prev, ativo: !!checked }))}
                                                disabled={loading}
                                            />
                                            <Label htmlFor="equipamentoAtivo">Ativo</Label>
                                        </div>
                                        <div className="col-span-2 flex justify-end gap-2 pt-4">
                                            {editingEquipamentoId && (
                                                <Button variant="outline" onClick={resetEquipamentoForm} disabled={loading}>
                                                    <XCircle className="h-4 w-4 mr-2" /> Cancelar
                                                </Button>
                                            )}
                                            <Button onClick={handleAddEquipamento} disabled={loading || !equipamentoTemp.nome_equipamento || equipamentoTemp.consumo <= 0}>
                                                {loading ? "Salvando..." : (editingEquipamentoId ? "Atualizar Equipamento" : "Adicionar Equipamento")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Equipamentos */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold">Equipamentos Cadastrados ({equipamentosConfig.length})</h4>
                                    {['Viatura', 'Gerador', 'Engenharia', 'Embarcacao'].map(tipo => {
                                        const itens = equipamentosConfig.filter(e => e.tipo_equipamento === tipo);
                                        if (itens.length === 0) return null;
                                        return (
                                            <div key={tipo} className="border rounded-lg p-3 space-y-2">
                                                <h5 className="font-bold text-sm text-primary">{tipo}</h5>
                                                {itens.map(item => (
                                                    <div key={item.id} className={cn("flex justify-between items-center p-2 rounded-md", item.ativo ? "bg-background" : "bg-red-50/50 opacity-70")}>
                                                        <div className="flex-1">
                                                            <p className="font-medium">{item.nome_equipamento}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.tipo_combustivel} | {formatNumberForInput(item.consumo, 2)} {item.unidade}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button size="icon" variant="ghost" onClick={() => handleEditEquipamento(item)} disabled={loading}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" onClick={() => handleRemoveEquipamento(item.id!)} disabled={loading}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// Função auxiliar para lidar com a mudança de preço (Classe I)
const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: React.Dispatch<React.SetStateAction<string>>, field: string) => {
    const rawValue = e.target.value;
    let cleaned = rawValue.replace(/[^\d,.]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
    cleaned = cleaned.replace(/\./g, '');
    setInput(cleaned);
};

const handlePriceBlur = (input: string, setInput: React.Dispatch<React.SetStateAction<string>>, field: string) => {
    const numericValue = parseInputToNumber(input);
    const formattedDisplay = formatNumberForInput(numericValue, 2);
    setInput(formattedDisplay);
};