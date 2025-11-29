import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Package, Briefcase, ArrowLeft, Calendar as CalendarIcon, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { ptrabSchema } from "@/lib/validationSchemas";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { PTrabCostSummary } from "@/components/PTrabCostSummary";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { RmSelector } from "@/components/RmSelector";

type PTrabData = Tables<'p_trab'> & {
  // Sobrescreve a tipagem para garantir que campos que podem ser nulos no DB sejam tratados como tal
  acoes: string; // Ações é obrigatório no formulário
  codug_om: string;
  codug_rm_vinculacao: string;
  comentario: string | null;
  data_fim: string;
  data_inicio: string;
  nome_om_extenso: string | undefined; // Pode ser undefined se não for carregado
  nome_operacao: string;
  numero_ptrab: string;
  organizacao: string;
  rm_vinculacao: string;
  status: 'aberto' | 'em_andamento' | 'concluido';
  tipo_operacao: string;
  valor_total: number;
  efetivo_empregado: string; // Mantido como string para input
};

const initialFormState: PTrabData = {
  id: "",
  user_id: "",
  created_at: "",
  updated_at: null,
  numero_ptrab: "",
  nome_operacao: "",
  tipo_operacao: "Operação",
  organizacao: "",
  codug_om: "",
  nome_om_extenso: "",
  comando_militar_area: "CMSE",
  rm_vinculacao: "",
  codug_rm_vinculacao: "",
  data_inicio: format(new Date(), 'yyyy-MM-dd'),
  data_fim: format(new Date(), 'yyyy-MM-dd'),
  efetivo_empregado: "",
  acoes: "",
  comentario: null,
  valor_total: 0,
  status: 'aberto',
};

export default function PTrabForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [loading, setLoading] = useState(false);
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(initialFormState);
  const [isEditing, setIsEditing] = useState(!!ptrabId);
  const [totalClasseII, setTotalClasseII] = useState(0);
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (ptrabId) {
      loadPTrab(ptrabId);
      fetchClasseIICosts(ptrabId);
    } else {
      setPtrabData(initialFormState);
      setIsEditing(false);
    }
  }, [ptrabId]);

  const loadPTrab = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Ajuste de tipagem e conversão de número para string para o input
      setPtrabData({
        ...(data as PTrabData),
        efetivo_empregado: String(data.efetivo_empregado), // Garante que seja string ao carregar
      });
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab: " + sanitizeError(error));
      navigate("/ptrab");
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClasseIICosts = async (id: string) => {
    // Usando 'as any' para contornar o erro de sobrecarga do Supabase Client
    const { data: classeIIData, error: errorII } = await supabase
      .from('classe_ii_registros' as any)
      .select('valor_total')
      .eq('p_trab_id', id);
    
    if (errorII) {
        console.error("Erro ao carregar custos Classe II:", errorII);
        return;
    }
    
    // Soma os valores totais dos registros de Classe II
    const totalClasseII = (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
    setTotalClasseII(totalClasseII);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setPtrabData(prev => (prev ? { ...prev, [id]: value } : null));
  };

  const handleSelectChange = (id: keyof PTrabData, value: string) => {
    setPtrabData(prev => (prev ? { ...prev, [id]: value } : null));
  };

  const handleDateChange = (field: 'data_inicio' | 'data_fim', date: Date | undefined) => {
    if (date) {
      setPtrabData(prev => (prev ? { ...prev, [field]: format(date, 'yyyy-MM-dd') } : null));
    }
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setPtrabData(prev => (prev ? { 
        ...prev, 
        organizacao: omData.nome_om, 
        codug_om: omData.codug_om,
        nome_om_extenso: omData.nome_om_extenso,
        rm_vinculacao: omData.rm_vinculacao,
        codug_rm_vinculacao: omData.codug_rm_vinculacao,
        comando_militar_area: omData.comando_militar_area,
      } : null));
    } else {
      setPtrabData(prev => (prev ? { 
        ...prev, 
        organizacao: "", 
        codug_om: "",
        nome_om_extenso: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
        comando_militar_area: "",
      } : null));
    }
  };
  
  const handleRMChange = (rmName: string, rmCodug: string) => {
    setPtrabData(prev => (prev ? { 
      ...prev, 
      rm_vinculacao: rmName,
      codug_rm_vinculacao: rmCodug,
    } : null));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ptrabData) return;

    const dataToValidate = {
      ...ptrabData,
      efetivo_empregado: Number(ptrabData.efetivo_empregado),
    };

    const validationResult = ptrabSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { user } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const dataToSave: TablesInsert<'p_trab'> = {
        ...ptrabData,
        user_id: user.id,
        efetivo_empregado: String(Number(ptrabData.efetivo_empregado)), // Salvar como string no DB
        // Garantir que campos opcionais sejam null se vazios
        comentario: ptrabData.comentario || null,
        nome_om_extenso: ptrabData.nome_om_extenso || null,
        acoes: ptrabData.acoes || "",
        valor_total: ptrabData.valor_total || 0,
      };
      
      // Remove campos que não devem ser inseridos/atualizados (como id e created_at em inserts)
      delete (dataToSave as any).id;
      delete (dataToSave as any).created_at;
      delete (dataToSave as any).updated_at;

      let result;
      if (isEditing && ptrabId) {
        // Update
        result = await supabase
          .from("p_trab")
          .update(dataToSave)
          .eq("id", ptrabId)
          .select()
          .single();
        toast.success("P Trab atualizado com sucesso!");
      } else {
        // Insert
        result = await supabase
          .from("p_trab")
          .insert([dataToSave])
          .select()
          .single();
        toast.success("P Trab criado com sucesso!");
        navigate(`/ptrab/form?ptrabId=${result.data.id}`);
      }
      
      setPtrabData({
        ...(result.data as PTrabData),
        efetivo_empregado: String(result.data.efetivo_empregado),
      });
      setIsEditing(true);

    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !ptrabData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ptrabData) return null;

  const startDate = ptrabData.data_inicio ? new Date(ptrabData.data_inicio + 'T00:00:00') : undefined;
  const endDate = ptrabData.data_fim ? new Date(ptrabData.data_fim + 'T00:00:00') : undefined;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/ptrab")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {isEditing ? "Editar P-Trab" : "Novo P-Trab"}
            </CardTitle>
            <CardDescription>
              {isEditing ? `Editando: ${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}` : "Preencha os dados básicos do seu Plano de Trabalho."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Seção 1: Identificação */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold">1. Identificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero_ptrab">Número do P-Trab *</Label>
                    <Input
                      id="numero_ptrab"
                      value={ptrabData.numero_ptrab}
                      onChange={handleChange}
                      placeholder="Ex: 01/2024"
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome_operacao">Nome da Operação/Atividade *</Label>
                    <Input
                      id="nome_operacao"
                      value={ptrabData.nome_operacao}
                      onChange={handleChange}
                      placeholder="Ex: Operação Acolhida"
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_operacao">Tipo de Operação *</Label>
                  <Select
                    value={ptrabData.tipo_operacao}
                    onValueChange={(value) => handleSelectChange('tipo_operacao', value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="tipo_operacao">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operação">Operação</SelectItem>
                      <SelectItem value="Adestramento">Adestramento</SelectItem>
                      <SelectItem value="Missão">Missão</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção 2: Organização e Comando */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold">2. Organização e Comando</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organizacao">OM Responsável *</Label>
                    <OmSelector
                      selectedOmId={ptrabData.organizacao} // Usando o nome da OM como ID temporário para busca
                      onChange={handleOMChange}
                      placeholder="Selecione a OM..."
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codug_om">UG da OM</Label>
                    <Input
                      id="codug_om"
                      value={ptrabData.codug_om}
                      readOnly
                      disabled
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rm_vinculacao">RM de Vinculação</Label>
                    <RmSelector
                      value={ptrabData.rm_vinculacao}
                      onChange={handleRMChange}
                      placeholder="Selecione a RM..."
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codug_rm_vinculacao">UG da RM</Label>
                    <Input
                      id="codug_rm_vinculacao"
                      value={ptrabData.codug_rm_vinculacao}
                      readOnly
                      disabled
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
                  <Select
                    value={ptrabData.comando_militar_area}
                    onValueChange={(value) => handleSelectChange('comando_militar_area', value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="comando_militar_area">
                      <SelectValue placeholder="Selecione o CMA" />
                    </SelectTrigger>
                    <SelectContent>
                      {["CMSE", "CML", "CMN", "CMNE", "CMO", "CMP", "CMR", "CMS", "CMA", "CMAM"].map(cma => (
                        <SelectItem key={cma} value={cma}>{cma}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção 3: Datas e Efetivo */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold">3. Período e Efetivo</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                          disabled={loading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => handleDateChange('data_inicio', date)}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Fim *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                          disabled={loading}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => handleDateChange('data_fim', date)}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="efetivo_empregado">Efetivo Empregado *</Label>
                    <Input
                      id="efetivo_empregado"
                      type="number"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={ptrabData.efetivo_empregado}
                      onChange={handleChange}
                      placeholder="Ex: 500"
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Seção 4: Ações e Comentários */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="text-lg font-semibold">4. Detalhamento</h3>
                <div className="space-y-2">
                  <Label htmlFor="acoes">Ações Previstas *</Label>
                  <Textarea
                    id="acoes"
                    value={ptrabData.acoes || ""}
                    onChange={handleChange}
                    placeholder="Descreva as principais ações e objetivos do P-Trab."
                    rows={4}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comentario">Comentários (Opcional)</Label>
                  <Textarea
                    id="comentario"
                    value={ptrabData.comentario || ""}
                    onChange={handleChange}
                    placeholder="Adicione observações relevantes."
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  {isEditing ? "Atualizar P-Trab" : "Criar P-Trab"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Navegação para Classes e Resumo de Custos */}
        {isEditing && ptrabId && (
          <div className="mt-8 space-y-6">
            <PTrabCostSummary ptrabId={ptrabId} ptrabData={ptrabData} />

            <Card>
              <CardHeader>
                <CardTitle>Configuração de Custos</CardTitle>
                <CardDescription>Acesse as seções para detalhar os custos por Classe de Suprimento.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/ptrab/classe-i?ptrabId=${ptrabId}`)}
                  className="h-20 flex flex-col items-start justify-center"
                >
                  <Users className="h-5 w-5 mb-1 text-green-600" />
                  <span className="font-semibold">Classe I (Subsistência)</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/ptrab/classe-ii?ptrabId=${ptrabId}`)}
                  className="h-20 flex flex-col items-start justify-center"
                >
                  <Briefcase className="h-5 w-5 mb-1 text-blue-600" />
                  <span className="font-semibold">Classe II (Intendência)</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/ptrab/classe-iii?ptrabId=${ptrabId}`)}
                  className="h-20 flex flex-col items-start justify-center"
                >
                  <Fuel className="h-5 w-5 mb-1 text-amber-600" />
                  <span className="font-semibold">Classe III (Combustível)</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/ptrab/export-import?ptrabId=${ptrabId}`)}
                  className="h-20 flex flex-col items-start justify-center md:col-span-3"
                >
                  <Package className="h-5 w-5 mb-1 text-gray-600" />
                  <span className="font-semibold">Exportar / Importar Dados</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}