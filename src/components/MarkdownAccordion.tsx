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

interface AccordionItemData {
  id: string;
  title: string;
  level: 2 | 3;
  content: string;
}

/**
 * Analisa o conteúdo Markdown para extrair títulos (H2 e H3) e o conteúdo subsequente.
 */
const parseMarkdownToAccordionData = (markdown: string): AccordionItemData[] => {
  const lines = markdown.split('\n');
  const items: AccordionItemData[] = [];
  let currentItem: AccordionItemData | null = null;
  let itemIdCounter = 0;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match || h3Match) {
      // Se já houver um item em construção, finalize-o
      if (currentItem) {
        items.push(currentItem);
      }

      const title = h2Match ? h2Match[1].trim() : h3Match![1].trim();
      const level = h2Match ? 2 : 3;
      
      // Inicia um novo item
      currentItem = {
        id: `item-${itemIdCounter++}`,
        title: title,
        level: level,
        content: '',
      };
    } else if (currentItem) {
      // Adiciona a linha ao conteúdo do item atual
      currentItem.content += line + '\n';
    }
  }

  // Adiciona o último item
  if (currentItem) {
    items.push(currentItem);
  }
  
  // Filtra itens que são apenas títulos (sem conteúdo útil)
  return items.filter(item => item.content.trim().length > 0);
};

export const MarkdownAccordion: React.FC<MarkdownAccordionProps> = ({ content, className }) => {
  const data = parseMarkdownToAccordionData(content);

  return (
    <div className={cn("w-full", className)}>
      <Accordion type="multiple" className="w-full">
        {data.map((item) => (
          <AccordionItem 
            key={item.id} 
            value={item.id} 
            className={cn(
              "border-b",
              item.level === 2 ? "border-primary/30" : "border-border/50",
              item.level === 2 ? "mt-4" : "mt-1"
            )}
          >
            <AccordionTrigger 
              className={cn(
                "py-3 text-left hover:no-underline",
                item.level === 2 ? "text-lg font-bold text-primary" : "text-base font-semibold text-foreground"
              )}
            >
              {item.title}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pl-4">
              {/* Renderiza o conteúdo do item usando o MarkdownViewer */}
              <MarkdownViewer content={item.content} className="prose-sm" />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};