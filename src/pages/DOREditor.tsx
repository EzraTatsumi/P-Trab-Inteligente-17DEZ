"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, FileText, ClipboardList } from "lucide-react";
import { useSession } from '@/components/SessionContextProvider';
import { runMission05 } from '@/tours/missionTours';
import { isGhostMode } from '@/lib/ghostStore';
import { toast } from 'sonner';
import PageMetadata from '@/components/PageMetadata';

const DOREditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const [isTourRunning, setIsTourRunning] = useState(false);

  useEffect(() => {
    const startTour = searchParams.get('startTour') === 'true';
    const isGhost = isGhostMode();
    
    if (startTour && isGhost && user?.id && !isTourRunning) {
      setIsTourRunning(true);
      const timer = setTimeout(() => {
        runMission05(user.id, () => {
          setIsTourRunning(false);
          toast.success("Missão 05 concluída!");
          navigate('/ptrab?showHub=true');
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [searchParams, user?.id, navigate, isTourRunning]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Editor de DOR" description="Redija o Documento de Oficialização da Requisição integrado aos custos do seu P Trab." />
      
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="btn-importar-dados-dor">
              <ClipboardList className="mr-2 h-4 w-4" /> Agrupar Custos do P Trab
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 btn-salvar-dor">
              <Save className="mr-2 h-4 w-4" /> Salvar DOR
            </Button>
          </div>
        </div>

        <Card className="tour-dor-document shadow-lg border-2">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-6 w-6 text-primary" />
                  DOR - Documento de Oficialização da Requisição
                </CardTitle>
                <p className="text-muted-foreground text-sm">Preencha os campos obrigatórios para gerar o documento oficial.</p>
              </div>
              <div className="text-right">
                <Label htmlFor="tour-dor-number">Número do DOR</Label>
                <Input id="tour-dor-number" placeholder="Ex: 01" className="w-24 text-center font-bold" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6 text-foreground">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 tour-dor-contato">
              <div className="space-y-2">
                <Label>E-mail do Requisitante *</Label>
                <Input type="email" placeholder="nome.sobrenome@eb.mil.br" />
              </div>
              <div className="space-y-2">
                <Label>Telefone/Ramal *</Label>
                <Input placeholder="(XX) XXXXX-XXXX" />
              </div>
            </div>

            <div className="space-y-2 tour-dor-finalidade">
              <Label>Finalidade *</Label>
              <Textarea placeholder="Descreva a finalidade técnica da requisição..." rows={3} defaultValue="Atender às necessidades logísticas da OPERAÇÃO SENTINELA, garantindo o suporte necessário às tropas empregadas na faixa de fronteira." />
            </div>

            <div className="space-y-2 tour-dor-motivacao">
              <Label>Motivação *</Label>
              <Textarea placeholder="Descreva a motivação/amparo legal..." rows={3} defaultValue="Msg Op nº 196 - CCOp/CMN, de 15 ABR 24. Necessidade de recompletamento de material de consumo para manutenção de instalações temporárias." />
            </div>

            <div className="space-y-2 tour-dor-consequencia">
              <Label>Consequência do Não Atendimento *</Label>
              <Textarea placeholder="Descreva os riscos..." rows={3} defaultValue="Degradação das condições de habitabilidade e comprometimento da segurança orgânica do Posto de Vigilância." />
            </div>

            <div className="space-y-2 tour-dor-observacoes">
              <Label>Observações Gerais</Label>
              <Textarea placeholder="Observações adicionais..." rows={3} defaultValue="Os custos detalhados estão em conformidade com o SIOP e memórias de cálculo extraídas do Plano de Trabalho nº 001/2026." />
            </div>

            <div className="border rounded-lg p-6 bg-muted/10 tour-dor-descricao-item">
              <h3 className="font-semibold mb-4 text-lg border-b pb-2">Descrição dos Itens e Valores</h3>
              <div className="text-center py-12 text-muted-foreground tour-dor-items-section">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Agrupe os custos do seu P Trab para preencher esta tabela automaticamente.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DOREditor;