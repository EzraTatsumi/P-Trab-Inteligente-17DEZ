import React from 'react';
import { Helmet } from 'react-helmet-async';

interface PageMetadataProps {
  title: string;
  description?: string;
  canonicalPath?: string;
}

const BASE_URL = "https://ptrab-inteligente.vercel.app"; // URL base do seu aplicativo no Vercel

const PageMetadata: React.FC<PageMetadataProps> = ({ title, description, canonicalPath }) => {
  const fullTitle = `${title} | PTrab Inteligente`;
  const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : `${BASE_URL}${window.location.pathname}`;
  const defaultDescription = "Sistema de Planejamento de Trabalho (P Trab) e gestão de custos logísticos e operacionais.";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      
      {/* Canonical URL para evitar conteúdo duplicado */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Social Media Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
};

export default PageMetadata;