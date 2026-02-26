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
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const OmConfigPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [oms, setOms] = useState<any[]>([]);
  const [newOm, setNewOm] = useState({ nome_om: '', codug_om: '', rm_vinculacao: '', codug_rm_vinculacao: '' });

  const fetchOms = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('organizacoes_militares').select('*').eq('user_id', user.id);
    setOms(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOms(); }, []);

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('organizacoes_militares').insert([{ ...newOm, user_id: user.id }]);
    if (error) {
      toast.error("Erro ao adicionar OM.");
    } else {
      await queryClient.invalidateQueries({ queryKey: ['user-status'] });
      toast.success("OM adicionada com sucesso!");
      setNewOm({ nome_om: '', codug_om: '', rm_vinculacao: '', codug_rm_vinculacao: '' });
      fetchOms();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('organizacoes_militares').delete().eq('id', id);
    if (error) {
      toast.error("Erro ao excluir OM.");
    } else {
      await queryClient.invalidateQueries({ queryKey: ['user-status'] });
      toast.success("OM excluída.");
      fetchOms();
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/ptrab')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <Card className="mb-8">
        <CardHeader><CardTitle>Adicionar Nova Organização Militar</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>Sigla OM</Label><Input value={newOm.nome_om} onChange={e => setNewOm({...newOm, nome_om: e.target.value})} /></div>
          <div className="space-y-2"><Label>CODUG OM</Label><Input value={newOm.codug_om} onChange={e => setNewOm({...newOm, codug_om: e.target.value})} /></div>
          <div className="space-y-2"><Label>Região Militar</Label><Input value={newOm.rm_vinculacao} onChange={e => setNewOm({...newOm, rm_vinculacao: e.target.value})} /></div>
          <div className="space-y-2"><Label>CODUG RM</Label><Input value={newOm.codug_rm_vinculacao} onChange={e => setNewOm({...newOm, codug_rm_vinculacao: e.target.value})} /></div>
          <Button onClick={handleAdd} className="col-span-full"><Plus className="mr-2" /> Adicionar OM</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Minhas Organizações Militares</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OM</TableHead>
                <TableHead>CODUG</TableHead>
                <TableHead>RM</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {oms.map(om => (
                <TableRow key={om.id}>
                  <TableCell>{om.nome_om}</TableCell>
                  <TableCell>{om.codug_om}</TableCell>
                  <TableCell>{om.rm_vinculacao}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(om.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OmConfigPage;