"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from('diretrizes_custeio')
        .select('*')
        .eq('user_id', user.id)
        .order('ano_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();

      setData(config || { ano_referencia: new Date().getFullYear(), classe_i_valor_qs: 0, classe_i_valor_qr: 0 });
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from('diretrizes_custeio')
        .upsert({ ...data, user_id: user.id }, { onConflict: 'user_id,ano_referencia' });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['user-status'] });
      toast.success("Diretrizes de custeio salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar dados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/ptrab')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Diretrizes de Custeio Logístico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ano de Referência</Label>
              <Input type="number" value={data?.ano_referencia} onChange={e => setData({...data, ano_referencia: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Valor Etapa QS (R$)</Label>
              <Input type="number" value={data?.classe_i_valor_qs} onChange={e => setData({...data, classe_i_valor_qs: parseFloat(e.target.value)})} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Diretrizes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiretrizesCusteioPage;