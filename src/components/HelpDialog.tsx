"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, Scale, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const HelpDialog = () => {
  const [userGuide, setUserGuide] = useState("");
  const [businessRules, setBusinessRules] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    try {
      // Busca os arquivos markdown. Adicionamos um timestamp para evitar cache do navegador.
      const cacheBuster = `?t=${new Date().getTime()}`;
      
      const [guideRes, rulesRes] = await Promise.all([
        fetch(`/src/docs/userguide.md${cacheBuster}`),
        fetch(`/src/docs/BusinessRules.md${cacheBuster}`)
      ]);

      if (guideRes.ok) {
        const text = await guideRes.text();
        setUserGuide(text);
      }
      
      if (rulesRes.ok) {
        const text = await rulesRes.text();
        setBusinessRules(text);
      }
    } catch (error) {
      console.error("Erro ao carregar documentos de ajuda:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && loadDocs()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full shadow-md">
          <HelpCircle className="h-5 w-5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6 text-primary" />
            Central de Ajuda e Regras
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="guide" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="guide" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Guia do Usuário
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Regras de Negócio
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <TabsContent value="guide" className="mt-0 focus-visible:ring-0">
                <div className="prose prose-sm dark:prose-invert max-w-none pb-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {userGuide || "Carregando guia..."}
                  </ReactMarkdown>
                </div>
              </TabsContent>

              <TabsContent value="rules" className="mt-0 focus-visible:ring-0">
                <div className="prose prose-sm dark:prose-invert max-w-none pb-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {businessRules || "Carregando regras..."}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;