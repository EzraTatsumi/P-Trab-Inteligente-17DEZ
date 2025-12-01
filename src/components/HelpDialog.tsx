import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Code, FileText, Loader2, ChevronDown } from "lucide-react";
import { MarkdownViewer } from './MarkdownViewer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { parseMarkdownToSections, MarkdownSection } from '@/lib/markdownParser'; // Importar parser

// Importar o conteúdo dos arquivos Markdown como strings
import architectureContent from '@/docs/Architecture.md?raw';
import businessRulesContent from '@/docs/BusinessRules.md?raw';

export const HelpDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Analisar o conteúdo Markdown em seções
  const businessSections = useMemo(() => parseMarkdownToSections(businessRulesContent), []);
  const architectureSections = useMemo(() => parseMarkdownToSections(architectureContent), []);
  
  // Simular um pequeno atraso para garantir que o conteúdo seja carregado
  useEffect(() => {
    if (open) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const renderSections = (sections: MarkdownSection[]) => (
    <Accordion type="multiple" className="w-full">
      {sections.map((section) => (
        <AccordionItem key={section.id} value={section.id}>
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline">
            {section.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {/* O MarkdownViewer renderiza o conteúdo da seção */}
            <MarkdownViewer content={section.content} className="pl-4" />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Ajuda e Documentação">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Ajuda e Documentação
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="business-rules" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-4 grid grid-cols-2 w-[calc(100%-3rem)]">
            <TabsTrigger value="business-rules" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Regras de Negócio
            </TabsTrigger>
            <TabsTrigger value="architecture" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Arquitetura
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando documentação...</span>
              </div>
            ) : (
              <>
                <TabsContent value="business-rules" className="mt-0 h-full">
                  <ScrollArea className="h-[calc(90vh-200px)] w-full pr-4">
                    {renderSections(businessSections)}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="architecture" className="mt-0 h-full">
                  <ScrollArea className="h-[calc(90vh-200px)] w-full pr-4">
                    {renderSections(architectureSections)}
                  </ScrollArea>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};