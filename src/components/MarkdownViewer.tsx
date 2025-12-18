"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  filePath: string;
  className?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filePath, className }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent(null);

    // Nota: O Vite lida com a importação de arquivos estáticos via fetch
    fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
        }
        return response.text();
      })
      .then(text => {
        setContent(text);
      })
      .catch(e => {
        console.error("Error loading markdown:", e);
        setError("Não foi possível carregar a documentação. Verifique o caminho do arquivo.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando documentação...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <span className="ml-2 text-destructive">{error}</span>
      </div>
    );
  }

  return (
    <div className={cn("prose dark:prose-invert max-w-none", className)}>
      <ReactMarkdown>
        {content || ''}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;