import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarkdownViewer } from './MarkdownViewer';
import { cn } from '@/lib/utils';

interface SubItem {
  id: string;
  title: string;
  level: 3;
  content: string;
}

interface MainItem {
  id: string;
  title: string;
  level: 2;
  content: string;
  subItems: SubItem[];
}

interface MarkdownAccordionProps {
  content: string;
  className?: string;
}

/**
 * Analisa o conteúdo Markdown para extrair títulos (H2 e H3) e o conteúdo subsequente,
 * organizando-os em uma estrutura hierárquica (H2 como item principal, H3 como subitem).
 */
const parseMarkdownToAccordionData = (markdown: string): MainItem[] => {
  const lines = markdown.split('\n');
  const items: MainItem[] = [];
  let currentMainItem: MainItem | null = null;
  let currentSubItem: SubItem | null = null;
  let itemIdCounter = 0;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match) {
      // Finaliza o item principal anterior, se houver
      if (currentMainItem) {
        if (currentSubItem) {
          currentMainItem.subItems.push(currentSubItem);
          currentSubItem = null;
        }
        items.push(currentMainItem);
      }
      
      // Inicia um novo item principal (H2)
      currentMainItem = {
        id: `main-item-${itemIdCounter++}`,
        title: h2Match[1].trim(),
        level: 2,
        content: '',
        subItems: [],
      };
      currentSubItem = null; // Reseta o subitem
    } else if (h3Match && currentMainItem) {
      // Finaliza o subitem anterior, se houver
      if (currentSubItem) {
        currentMainItem.subItems.push(currentSubItem);
      }
      
      // Inicia um novo subitem (H3)
      currentSubItem = {
        id: `sub-item-${itemIdCounter++}`,
        title: h3Match[1].trim(),
        level: 3,
        content: '',
      };
    } else if (currentSubItem) {
      // Adiciona conteúdo ao subitem atual
      currentSubItem.content += line + '\n';
    } else if (currentMainItem) {
      // Adiciona conteúdo ao item principal (se não houver subitem ativo)
      currentMainItem.content += line + '\n';
    }
  }

  // Adiciona o último item
  if (currentMainItem) {
    if (currentSubItem) {
      currentMainItem.subItems.push(currentSubItem);
    }
    items.push(currentMainItem);
  }
  
  // Filtra itens principais que não têm conteúdo nem subitens
  return items.filter(item => item.content.trim().length > 0 || item.subItems.length > 0);
};

export const MarkdownAccordion: React.FC<MarkdownAccordionProps> = ({ content, className }) => {
  const data = parseMarkdownToAccordionData(content);

  return (
    <div className={cn("w-full", className)}>
      <Accordion type="multiple" className="w-full">
        {data.map((mainItem) => (
          <AccordionItem 
            key={mainItem.id} 
            value={mainItem.id} 
            className="border-b border-primary/30 mt-4"
          >
            <AccordionTrigger 
              className="py-3 text-left hover:no-underline text-lg font-bold text-primary"
            >
              {mainItem.title}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pl-0">
              
              {/* Conteúdo direto do H2 (se houver) */}
              {mainItem.content.trim().length > 0 && (
                <div className="mb-4 pl-4">
                  <MarkdownViewer content={mainItem.content} className="prose-sm" />
                </div>
              )}

              {/* Acordeão Aninhado para Subtópicos (H3) */}
              {mainItem.subItems.length > 0 && (
                <Accordion type="multiple" className="w-full pl-4">
                  {mainItem.subItems.map((subItem) => (
                    <AccordionItem 
                      key={subItem.id} 
                      value={subItem.id} 
                      className="border-b border-border/50 mt-1"
                    >
                      <AccordionTrigger 
                        className="py-2 text-left hover:no-underline text-base font-semibold text-foreground"
                      >
                        {subItem.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pl-4">
                        <MarkdownViewer content={subItem.content} className="prose-xs" />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};