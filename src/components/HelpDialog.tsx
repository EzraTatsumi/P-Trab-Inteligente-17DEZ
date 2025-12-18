import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, Shield, Code, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkdownViewer from './MarkdownViewer'; // Importar o novo componente

const DOC_TABS = [
  {
    value: "guia",
    label: "Guia do Usuário",
    icon: BookOpen,
    path: "/docs/UserGuide.md", // Caminho atualizado
  },
  {
    value: "regras",
    label: "Regras de Negócio",
    icon: FileText,
    path: "/docs/BusinessRules.md", // Caminho atualizado
  },
  {
    value: "seguranca",
    label: "Segurança",
    icon: Shield,
    path: "/docs/SecurityCompliance.md", // Caminho atualizado
  },
  {
    value: "arquitetura",
    label: "Arquitetura",
    icon: Code,
    path: "/docs/Architecture.md", // Caminho atualizado
  },
];

export const HelpDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(DOC_TABS[0].value);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Ajuda e Documentação
          </DialogTitle>
          <DialogDescription>
            Consulte o guia completo de uso, regras de negócio e arquitetura do sistema.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-4">
            {DOC_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 p-6 pt-4">
            {DOC_TABS.map(tab => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <MarkdownViewer filePath={tab.path} />
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};