import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { XCircle, Save, Fuel, Droplet } from "lucide-react";
import { formatCurrency, formatNumber, formatNumberForInput } from "@/lib/formatUtils"; // Importando formatNumberForInput

// Tipagem simplificada para o registro
type ClasseIIIRegistry = Tables<'classe_iii_registros'>;

interface ClasseIIIRegistryFormProps {
  ptrabId: string;
  initialData?: ClasseIIIRegistry | null;
  onSave: (data: TablesInsert<'classe_iii_registros'> | TablesUpdate<'classe_iii_registros'>) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

// Helper function to format input value to 2 decimal places on blur
const formatDecimalInput = (value: string): string => {
  // 1. Replace comma with dot for reliable parsing
  const cleanedValue = value.replace(',', '.');
  const numericValue = parseFloat(cleanedValue);

  if (isNaN(numericValue) || numericValue === 0) {
    return ""; // Retorna string vazia se for 0 ou NaN
  }

  // 2. Usa a função utilitária para formatar com 2 casas decimais
  return formatNumberForInput(numericValue, 2);
};

const ClasseIIIRegistryForm = ({
  ptrabId,
  initialData,
  onSave,
  onCancel,
  loading,
}: ClasseIIIRegistryFormProps) => {
  const [formData, setFormData] = useState<Omit<ClasseIIIRegistry, 'id' | 'created_at' | 'updated_at'>>({
    p_trab_id: ptrabId,
    tipo_combustivel: initialData?.tipo_combustivel || 'gasolina',
    quantidade: initialData?.quantidade || 0,
    preco_litro: initialData?.preco_litro ? formatDecimalInput(String(initialData.preco_litro)) : '', // Inicializa com string vazia se 0
    total_litros: initialData?.total_litros || 0,
    valor_total: initialData?.valor_total || 0,
    consumo_lubrificante_litro: initialData?.consumo_lubrificante_litro || 0,
    preco_lubrificante: initialData?.preco_lubrificante ? formatDecimalInput(String(initialData.preco_lubrificante)) : '', // Inicializa com string vazia se 0
    itens_equipamentos: initialData?.itens_equipamentos || null,
    dias_operacao: initialData?.dias_operacao || 0,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        p_trab_id: ptrabId,
        tipo_combustivel: initialData.tipo_combustivel,
        quantidade: initialData.quantidade,
        preco_litro: formatDecimalInput(String(initialData.preco_litro)),
        total_litros: initialData.total_litros,
        valor_total: initialData.valor_total,
        consumo_lubrificante_litro: initialData.consumo_lubrificante_litro,
        preco_lubrificante: formatDecimalInput(String(initialData.preco_lubrificante)),
        itens_equipamentos: initialData.itens_equipamentos,
        dias_operacao: initialData.dias_operacao,
      });
    }
  }, [initialData, ptrabId]);

  // Função para calcular totais
  const calculateTotals = useMemo(() => {
    // Usamos parseInputToNumber para garantir que a string do input (com vírgula) seja lida corretamente
    const precoLitro = parseFloat(String(formData.preco_litro).replace(',', '.')) || 0;
    const precoLubrificante = parseFloat(String(formData.preco_lubrificante).replace(',', '.')) || 0;
    const quantidade = formData.quantidade || 0;
    const consumoLubrificante = formData.consumo_lubrificante_litro || 0;

    const totalLitros = quantidade * (formData.dias_operacao || 1);
    
    // Cálculo do valor total: (Litros * Preço Litro) + (Litros * Consumo Lubrificante * Preço Lubrificante)
    const valorCombustivel = totalLitros * precoLitro;
    const valorLubrificante = totalLitros * consumoLubrificante * precoLubrificante;
    
    const valorTotal = valorCombustivel + valorLubrificante;

    return { totalLitros, valorTotal };
  }, [formData.preco_litro, formData.preco_lubrificante, formData.quantidade, formData.dias_operacao, formData.consumo_lubrificante_litro]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      total_litros: calculateTotals.totalLitros,
      valor_total: calculateTotals.valorTotal,
    }));
  }, [calculateTotals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    
    if (id === 'quantidade' || id === 'dias_operacao' || id === 'consumo_lubrificante_litro') {
      // Permite apenas números inteiros ou decimais (usando vírgula ou ponto)
      const numericValue = value.replace(/[^0-9,.]/g, '');
      setFormData(prev => ({ ...prev, [id]: parseFloat(numericValue.replace(',', '.')) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'preco_litro' | 'preco_lubrificante') => {
    const rawValue = e.target.value;
    // Permite digitação livre, incluindo vírgula ou ponto, mas sem caracteres extras
    const cleanedValue = rawValue.replace(/[^0-9,.]/g, '');
    setFormData(prev => ({ ...prev, [field]: cleanedValue }));
  };

  // Handler para formatar o preço ao perder o foco
  const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, field: 'preco_litro' | 'preco_lubrificante') => {
    const formattedValue = formatDecimalInput(e.target.value);
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação final antes de salvar
    const precoLitroFloat = parseFloat(String(formData.preco_litro).replace(',', '.')) || 0;
    const precoLubrificanteFloat = parseFloat(String(formData.preco_lubrificante).replace(',', '.')) || 0;

    if (formData.quantidade <= 0) {
      toast.error("A quantidade de equipamentos deve ser maior que zero.");
      return;
    }
    if (formData.dias_operacao <= 0) {
      toast.error("O número de dias de operação deve ser maior que zero.");
      return;
    }
    if (precoLitroFloat <= 0) {
      toast.error("O preço do litro de combustível deve ser maior que zero.");
      return;
    }
    
    const dataToSave: TablesInsert<'classe_iii_registros'> | TablesUpdate<'classe_iii_registros'> = {
      ...formData,
      // Garante que os preços sejam salvos como float no DB
      preco_litro: precoLitroFloat, 
      preco_lubrificante: precoLubrificanteFloat,
      // Garante que os totais calculados sejam salvos
      total_litros: calculateTotals.totalLitros,
      valor_total: calculateTotals.valorTotal,
    };

    await onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 border rounded-lg bg-card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Tipo de Combustível */}
        <div className="space-y-2">
          <Label htmlFor="tipo_combustivel">Tipo de Combustível *</Label>
          <Select
            value={formData.tipo_combustivel}
            onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_combustivel: value as ClasseIIIRegistry['tipo_combustivel'] }))}
            disabled={loading}
          >
            <SelectTrigger id="tipo_combustivel">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gasolina">Gasolina</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="aviacao">Aviação</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Quantidade de Equipamentos */}
        <div className="space-y-2">
          <Label htmlFor="quantidade">Qtd. Equipamentos/Viaturas *</Label>
          <Input
            id="quantidade"
            type="number"
            value={formData.quantidade || ''}
            onChange={handleChange}
            placeholder="Ex: 5"
            required
            min="1"
            disabled={loading}
          />
        </div>
        
        {/* Dias de Operação */}
        <div className="space-y-2">
          <Label htmlFor="dias_operacao">Dias de Operação *</Label>
          <Input
            id="dias_operacao"
            type="number"
            value={formData.dias_operacao || ''}
            onChange={handleChange}
            placeholder="Ex: 10"
            required
            min="1"
            disabled={loading}
          />
        </div>
        
        {/* Preço do Litro (Combustível) */}
        <div className="space-y-2">
          <Label htmlFor="preco_litro" className="flex items-center gap-1">
            <Fuel className="h-4 w-4 text-primary" />
            Preço do Litro (R$) *
          </Label>
          <Input
            id="preco_litro"
            type="text" // Alterado para text para permitir digitação livre
            value={formData.preco_litro}
            onChange={(e) => handlePriceChange(e, 'preco_litro')}
            onBlur={(e) => handlePriceBlur(e, 'preco_litro')} // NOVO: Formatação ao sair
            placeholder="0,00"
            required
            disabled={loading}
          />
        </div>
        
        {/* Consumo Lubrificante (Litro/Dia) */}
        <div className="space-y-2">
          <Label htmlFor="consumo_lubrificante_litro">Consumo Lubrificante (L/Dia)</Label>
          <Input
            id="consumo_lubrificante_litro"
            type="number"
            step="0.01"
            value={formData.consumo_lubrificante_litro || ''}
            onChange={handleChange}
            placeholder="Ex: 0.05"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Consumo por litro de combustível (Ex: 0.05 para 5%)
          </p>
        </div>
        
        {/* Preço do Lubrificante */}
        <div className="space-y-2">
          <Label htmlFor="preco_lubrificante" className="flex items-center gap-1">
            <Droplet className="h-4 w-4 text-primary" />
            Preço do Lubrificante (R$)
          </Label>
          <Input
            id="preco_lubrificante"
            type="text" // Alterado para text para permitir digitação livre
            value={formData.preco_lubrificante}
            onChange={(e) => handlePriceChange(e, 'preco_lubrificante')}
            onBlur={(e) => handlePriceBlur(e, 'preco_lubrificante')} // NOVO: Formatação ao sair
            placeholder="0,00"
            disabled={loading}
          />
        </div>
      </div>
      
      {/* Resultados Calculados */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
        <div className="space-y-2">
          <Label>Total de Litros (Combustível)</Label>
          <Input
            value={formatNumber(calculateTotals.totalLitros)}
            disabled
            className="bg-muted font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label>Valor Total (R$)</Label>
          <Input
            value={formatCurrency(calculateTotals.valorTotal)}
            disabled
            className="bg-muted font-bold text-lg text-green-600"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <XCircle className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : (initialData ? "Atualizar Registro" : "Adicionar Registro")}
        </Button>
      </div>
    </form>
  );
};

export default ClasseIIIRegistryForm;