export interface MarkdownSection {
  id: string;
  title: string;
  content: string;
}

/**
 * Analisa uma string Markdown e a divide em seções baseadas em cabeçalhos H2 (##).
 * O conteúdo de cada seção inclui o texto até o próximo cabeçalho H2.
 * @param markdownString A string de conteúdo Markdown.
 * @returns Um array de objetos MarkdownSection.
 */
export const parseMarkdownToSections = (markdownString: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  
  // Regex para encontrar cabeçalhos H2 (##) no início de uma linha
  // Captura o título e o conteúdo subsequente até o próximo H2 ou o fim da string.
  const regex = /^(##\s+(.*))([\s\S]*?)(?=^##\s+|$)/gm;
  
  let match;
  let index = 0;

  while ((match = regex.exec(markdownString)) !== null) {
    // match[1] é o cabeçalho completo (ex: ## Título)
    // match[2] é o título (ex: Título)
    // match[3] é o conteúdo da seção
    
    const title = match[2].trim();
    let content = match[3].trim();
    
    // Remove cabeçalhos H1, H3, H4, etc. do conteúdo para evitar aninhamento incorreto
    // Deixamos apenas o conteúdo puro para ser renderizado pelo MarkdownViewer
    content = content.replace(/^#+\s+/gm, '');

    sections.push({
      id: `section-${index++}-${title.toLowerCase().replace(/\s/g, '-')}`,
      title: title,
      content: content,
    });
  }

  return sections;
};