H3) e exibir apenas os tópicos de primeiro nível inicialmente.">
import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarkdownViewer } from './MarkdownViewer';
import { cn } from '@/lib/utils';

interface MarkdownAccordionProps {
  content: string;
  className?: string;
}

interface NestedAccordionItem {
  id: string;
  title: string;
  level: 2 | 3;
  content: string;
  children?: NestedAccordionItem[];
}

/**
 * Analisa o conteúdo Markdown para criar uma estrutura hierárquica (H2 como pai, H3 como filho).
 */
const parseMarkdownToNestedAccordionData = (markdown: string): NestedAccordionItem[] => {
  const lines = markdown.split('\n');
  const rootItems: NestedAccordionItem[] = [];
  let currentH2: NestedAccordionItem | null = null;
  let currentH3: NestedAccordionItem | null = null;
  let itemIdCounter = 0;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match) {
      // Finaliza o item H2 anterior (e seu H3 filho)
      if (currentH3) {
        currentH2!.children!.push(currentH3);
        currentH3 = null;
      }
      if (currentH2) {
        rootItems.push(currentH2);
      }

      // Inicia um novo H2
      currentH2 = {
        id: `h2-${itemIdCounter++}`,
        title: h2Match[1].trim(),
        level: 2,
        content: '',
        children: [],
      };
    } else if (h3Match) {
      // Se já houver um H3 em construção, finalize-o e adicione ao H2 pai
      if (currentH3) {
        currentH2!.children!.push(currentH3);
      }
      
      // Inicia um novo H3
      currentH3 = {
        id: `h3-${itemIdCounter++}`,
        title: h3Match[1].trim(),
        level: 3,
        content: '',
      };
    } else if (currentH3) {
      // Adiciona conteúdo ao H3 atual
      currentH3.content += line + '\n';
    } else if (currentH2) {
      // Adiciona conteúdo ao H2 atual (antes do primeiro H3)
      currentH2.content += line + '\n';
    }
  }

  // Adiciona os itens restantes
  if (currentH3) {
    currentH2!.children!.push(currentH3);
  }
  if (currentH2) {
    rootItems.push(currentH2);
  }
  
  // Filtra itens H2 que não têm conteúdo nem filhos (raro, mas possível)
  return rootItems.filter(item => item.content.trim().length > 0 || (item.children && item.children.length > 0));
};

// Componente recursivo para renderizar os itens
const AccordionItemRenderer: React.FC<{ item: NestedAccordionItem }> = ({ item }) => {
  const hasContent = item.content.trim().length > 0;
  const hasChildren = item.children && item.children.length > 0;
  
  // Se for H3, renderiza o conteúdo diretamente
  if (item.level === 3) {
    return (
      <AccordionItem 
        value={item.id} 
        className="border-b border-border/50"
      >
        <AccordionTrigger className="py-2 text-left text-sm font-medium hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="pb-4 pl-4">
          <MarkdownViewer content={item.content} className="prose-xs" />
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Se for H2, renderiza o conteúdo e os filhos aninhados
  return (
    <AccordionItem 
      value={item.id} 
      className="border-b border-primary/30 mt-4"
    >
      <AccordionTrigger 
        className="py-3 text-left text-lg font-bold text-primary hover:no-underline"
      >
        {item.title}
      </AccordionTrigger>
      <AccordionContent className="pb-4 pl-0">
        {/* Conteúdo do H2 (se houver) */}
        {hasContent && (
          <div className="pb-4 pl-4">
            <MarkdownViewer content={item.content} className="prose-sm" />
          </div>
        )}
        
        {/* Acordeão aninhado para os filhos H3 */}
        {hasChildren && (
          <Accordion type="multiple" className="w-full pl-4">
            {item.children!.map(child => (
              <AccordionItemRenderer key={child.id} item={child} />
            ))}
          </Accordion>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};


export const MarkdownAccordion: React.FC<MarkdownAccordionProps> = ({ content, className }) => {
  const data = parseMarkdownToNestedAccordionData(content);

  return (
    <div className={cn("w-full", className)}>
      <Accordion type="multiple" className="w-full">
        {data.map((item) => (
          <AccordionItemRenderer key={item.id} item={item} />
        ))}
      </Accordion>
    </div>
  );
};