import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, Edit, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, parseCurrency } from "@/lib/formatUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useSession } from "@/components/SessionContextProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Diretriz = Tables<'diretrizes_custeio'>;

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [diretrizes, setDiretrizes] = useState<Diretriz[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Diretriz, 'id' | 'user_id' | 'created_at' | 'updated_at'>>({
    ano_referencia: new Date().getFullYear(),
    classe_i_valor_qs: 0,
    classe_i_valor_qr: 0,
    classe_iii_fator_gerador: 0,
    classe_iii_fator_embarcacao: 0,
    classe_iii_fator_equip_engenharia: 0,
    observacoes: null,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [diretrizToDelete, setDiretrizToDelete] = useState<Diretriz | null>(null);

  const fetchDiretrizes = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('diretrizes_custeio')
        .select('*')
        .eq('user_id', user.id)
        .order('ano_referencia', { ascending: false });

      if (error) throw error;
      setDiretrizes(data || []);
    } catch (error) {
      toast.error("Erro ao carregar diretrizes.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDiretrizes();
  }, [fetchDiretrizes]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormData({
      ano_referencia: new Date().getFullYear(),
      classe_i_valor_qs: 0,
      classe_i_valor_qr: 0,
      classe_iii_fator_gerador: 0,
      classe_iii_fator_embarcacao: 0,
      classe_iii_fator_equip_engenharia: 0,
      observacoes: null,
    });
  }, []);

  const handleEdit = (diretriz: Diretriz) => {
    setEditingId(diretriz.id);
    setFormData({
      ano_referencia: diretriz.ano_referencia,
      classe_i_valor_qs: diretriz.classe_i_valor_qs,
      classe_i_valor_qr: diretriz.classe_i_valor_qr,
      classe_iii_fator_gerador: diretriz.classe_iii_fator_gerador,
      classe_iii_fator_embarcacao: diretriz.classe_iii_fator_embarcacao,
      classe_iii_fator_equip_engenharia: diretriz.classe_iii_fator_equip_engenharia,
      observacoes: diretriz.observacoes,
    });
  };

  const handleDeleteClick = (diretriz: Diretriz) => {
    setDiretrizToDelete(diretriz);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!diretrizToDelete) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('diretrizes_custeio')
        .delete()
        .eq('id', diretrizToDelete.id);

      if (error) throw error;

      toast.success(`Diretriz de ${diretrizToDelete.ano_referencia} excluída com sucesso.`);
      fetchDiretrizes();
      if (editingId === diretrizToDelete.id) {
        resetForm();
      }
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
      setShowDeleteDialog(false);
      setDiretrizToDelete(null);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNumericChange = (field: keyof typeof formData, e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = parseCurrency(e.target.value);
    handleInputChange(field, parsedValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSaving(true);

    try {
      const dataToSave: TablesInsert<'diretrizes_custeio'> = {
        ...formData,
        user_id: user.id,
        // Garantir que os valores numéricos sejam tratados como números
        classe_i_valor_qs: Number(formData.classe_i_valor_qs),
        classe_i_valor_qr: Number(formData.classe_i_valor_qr),
        classe_iii_fator_gerador: Number(formData.classe_iii_fator_gerador),
        classe_iii_fator_embarcacao: Number(formData.classe_iii_fator_embarcacao),
        classe_iii_fator_equip_engenharia: Number(formData.classe_iii_fator_equip_engenharia),
      };

      if (editingId) {
        const { error } = await supabase
          .from('diretrizes_custeio')
          .update(dataToSave as TablesUpdate<'diretrizes_custeio'>)
          .eq('id', editingId);
        if (error) throw error;
        toast.success("Diretriz atualizada com sucesso!");
      } else {
        // Verifica se já existe uma diretriz para o ano
        const existing = diretrizes.find(d => d.ano_referencia === formData.ano_referencia);
        if (existing) {
          throw new Error(`Já existe uma diretriz cadastrada para o ano de ${formData.ano_referencia}. Por favor, edite a existente.`);
        }

        const { error } = await supabase
          .from('diretrizes_custeio')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success("Nova diretriz criada com sucesso!");
      }

      resetForm();
      fetchDiretrizes();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + 2 - i); // Current year + 2, current year + 1, current year, current year - 1, current year - 2

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            Diretrizes de Custeio
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? `Editar Diretriz de ${formData.ano_referencia}` : "Nova Diretriz de Custeio"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ano_referencia">Ano de Referência *</Label>
                  <Select
                    value={String(formData.ano_referencia)}
                    onValueChange={(value) => handleInputChange('ano_referencia', Number(value))}
                    disabled={!!editingId || isSaving}
                  >
                    <SelectTrigger id="ano_referencia">
                      <SelectValue placeholder="Selecione o ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h3 className="text-lg font-semibold mt-6 border-b pb-2">Classe I - Alimentação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Valor QS (R$/dia/militar) *</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-24"
                      value={formatCurrency(formData.classe_i_valor_qs)}
                      onChange={(e) => handleNumericChange('classe_i_valor_qs', e)}
                      required
                      disabled={isSaving}
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                      R$/dia/militar
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor QR (R$/dia/militar) *</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-24"
                      value={formatCurrency(formData.classe_i_valor_qr)}
                      onChange={(e) => handleNumericChange('classe_i_valor_qr', e)}
                      required
                      disabled={isSaving}
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted-foreground pointer-events-none">
                      R$/dia/militar
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mt-6 border-b pb-2">Classe III - Combustíveis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fator_gerador">Fator Gerador (L/h) *</Label>
                  <Input
                    id="fator_gerador"
                    type="text"
                    inputMode="numeric"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={String(formData.classe_iii_fator_gerador)}
                    onChange={(e) => handleNumericChange('classe_iii_fator_gerador', e)}
                    required
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Consumo de combustível por hora de gerador (L/h).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fator_embarcacao">Fator Embarcação (L/h) *</Label>
                  <Input
                    id="fator_embarcacao"
                    type="text"
                    inputMode="numeric"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={String(formData.classe_iii_fator_embarcacao)}
                    onChange={(e) => handleNumericChange('classe_iii_fator_embarcacao', e)}
                    required
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Consumo de combustível por hora de embarcação (L/h).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fator_equip_engenharia">Fator Equip. Engenharia (L/h) *</Label>
                  <Input
                    id="fator_equip_engenharia"
                    type="text"
                    inputMode="numeric"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={String(formData.classe_iii_fator_equip_engenharia)}
                    onChange={(e) => handleNumericChange('classe_iii_fator_equip_engenharia', e)}
                    required
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Consumo de combustível por hora de equipamento de engenharia (L/h).</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold mt-6 border-b pb-2">Observações</h3>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Adicionais</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes || ""}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  rows={3}
                  maxLength={500}
                  disabled={isSaving}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                    Cancelar Edição
                  </Button>
                )}
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {editingId ? "Atualizar Diretriz" : "Criar Diretriz"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diretrizes Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              </div>
            ) : diretrizes.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma diretriz de custeio cadastrada.</p>
            ) : (
              <div className="space-y-4">
                {diretrizes.map((diretriz) => (
                  <div key={diretriz.id} className="border p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-lg font-semibold">Ano: {diretriz.ano_referencia}</p>
                      <p className="text-sm text-muted-foreground">QS: {formatCurrency(diretriz.classe_i_valor_qs)} | QR: {formatCurrency(diretriz.classe_i_valor_qr)}</p>
                      <p className="text-xs text-muted-foreground">Fatores C III: Gerador {diretriz.classe_iii_fator_gerador} L/h, Embarcação {diretriz.classe_iii_fator_embarcacao} L/h, Eng. {diretriz.classe_iii_fator_equip_engenharia} L/h</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleEdit(diretriz)}
                        disabled={isSaving}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => handleDeleteClick(diretriz)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a diretriz de custeio para o ano de <span className="font-bold">{diretrizToDelete?.ano_referencia}</span>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DiretrizesCusteioPage;