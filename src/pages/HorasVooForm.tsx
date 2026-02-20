"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Trash2, Pencil, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import PageMetadata from "@/components/PageMetadata";

const initialFormState = {
  organizacao: "",
  ug: "",
  codug_destino: "",
  municipio: "",
  quantidade_hv: 0,
  tipo_anv: "",
  fase_atividade: "",
  amparo: "",
  valor_nd_30: 0,
  valor_nd_39: 0,
  detalhamento_customizado: "",
};

const HorasVooForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const { handleEnterToNextField } = useFormNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("P Trab não identificado.");
      navigate("/ptrab");
      return;
    }
    loadRecords();
  }, [ptrabId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("horas_voo_registros")
        .select("*")
        .eq("p_trab_id", ptrabId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar registros.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organizacao || !formData.ug || !formData.tipo_anv || formData.quantidade_hv <= 0) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const valorTotal = Number(formData.valor_nd_30) + Number(formData.valor_nd_39);
      const payload = {
        ...formData,
        p_trab_id: ptrabId,
        valor_total: valorTotal,
      };

      if (editingId) {
        const { error } = await supabase
          .from("horas_voo_registros")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Registro atualizado!");
      } else {
        const { error } = await supabase
          .from("horas_voo_registros")
          .insert([payload]);
        if (error) throw error;
        toast.success("Registro salvo com sucesso!");
      }

      // RESET DO FORMULÁRIO APÓS SALVAR
      setFormData(initialFormState);
      setEditingId(null);
      loadRecords();
    } catch (error: any) {
      toast.error("Erro ao salvar registro.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setFormData({
      organizacao: record.organizacao,
      ug: record.ug,
      codug_destino: record.codug_destino,
      municipio: record.municipio,
      quantidade_hv: record.quantidade_hv,
      tipo_anv: record.tipo_anv,
      fase_atividade: record.fase_atividade || "",
      amparo: record.amparo || "",
      valor_nd_30: record.valor_nd_30,
      valor_nd_39: record.valor_nd_39,
      detalhamento_customizado: record.detalhamento_customizado || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;
    try {
      const { error } = await supabase.from("horas_voo_registros").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro excluído.");
      loadRecords();
    } catch (error: any) {
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Horas de Voo (AvEx)" description="Lançamento de horas de voo para o P Trab." />
      
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-6 w-6 text-primary" />
              {editingId ? "Editar Horas de Voo" : "Lançar Horas de Voo"}
            </CardTitle>
            <CardDescription>Informe os detalhes da aeronave e o custo das horas de voo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Organização (Sigla) *</Label>
                  <Input 
                    value={formData.organizacao} 
                    onChange={e => setFormData({...formData, organizacao: e.target.value})} 
                    onKeyDown={handleEnterToNextField}
                    placeholder="Ex: 1º BAvEx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CODUG da OM *</Label>
                  <Input 
                    value={formData.ug} 
                    onChange={e => setFormData({...formData, ug: e.target.value.replace(/\D/g, "").slice(0, 6)})} 
                    onKeyDown={handleEnterToNextField}
                    placeholder="000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Aeronave *</Label>
                  <Input 
                    value={formData.tipo_anv} 
                    onChange={e => setFormData({...formData, tipo_anv: e.target.value})} 
                    onKeyDown={handleEnterToNextField}
                    placeholder="Ex: HA-1 Fennec"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade de HV *</Label>
                  <Input 
                    type="number" 
                    value={formData.quantidade_hv || ""} 
                    onChange={e => setFormData({...formData, quantidade_hv: Number(e.target.value)})} 
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor ND 30 (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.valor_nd_30 || ""} 
                    onChange={e => setFormData({...formData, valor_nd_30: Number(e.target.value)})} 
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor ND 39 (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.valor_nd_39 || ""} 
                    onChange={e => setFormData({...formData, valor_nd_39: Number(e.target.value)})} 
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CODUG Destino</Label>
                  <Input 
                    value={formData.codug_destino} 
                    onChange={e => setFormData({...formData, codug_destino: e.target.value})} 
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Município</Label>
                  <Input 
                    value={formData.municipio} 
                    onChange={e => setFormData({...formData, municipio: e.target.value})} 
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Detalhamento / Justificativa</Label>
                <Textarea 
                  value={formData.detalhamento_customizado} 
                  onChange={e => setFormData({...formData, detalhamento_customizado: e.target.value})} 
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); setFormData(initialFormState); }}>
                    Cancelar Edição
                  </Button>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {editingId ? "Atualizar Registro" : "Salvar Registro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registros Lançados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OM / Aeronave</TableHead>
                    <TableHead className="text-center">HV</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium">{record.organizacao}</div>
                        <div className="text-xs text-muted-foreground">{record.tipo_anv}</div>
                      </TableCell>
                      <TableCell className="text-center">{record.quantidade_hv}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(record.valor_total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HorasVooForm;