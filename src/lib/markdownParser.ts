export interface MarkdownSection {
  id: string;
  title: string;
  content: string;
}

/**
 * Analisa uma string Markdown e a divide em seções baseadas em cabeçalhos H2 (##).
 * O conteúdo de cada seção inclui o texto até o próximo cabeçalho H2 ou o fim da string.
 * @param markdownString A string de conteúdo Markdown.
 * @returns Um array de objetos MarkdownSection.
 */
export const parseMarkdownToSections = (markdownString: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  
  // Regex para encontrar cabeçalhos H2 (##) no início de uma linha
  // Captura o cabeçalho completo (match[1]), o título (match[2]) e o conteúdo subsequente (match[3])
  // O conteúdo subsequente é tudo até o próximo H2 ou o fim da string.
  const regex = /^(##\s+(.*))([\s\S]*?)(?=^##\s+|$)/gm;
  
  let match;
  let index = 0;

  while ((match = regex.exec(markdownString)) !== null) {
    const title = match[2].trim();
    let content = match[3].trim();
    
    // A correção é remover a linha que limpava todos os cabeçalhos internos:
    // content = content.replace(/^#+\s+/gm, ''); // <-- Esta linha foi removida
    
    sections.push({
      id: `section-${index++}-${title.toLowerCase().replace(/\s/g, '-')}`,
      title: title,
      content: content,
    });
  }

  return sections;
};