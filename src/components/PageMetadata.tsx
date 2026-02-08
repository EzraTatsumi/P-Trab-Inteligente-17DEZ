import React from 'react';
import { Helmet } from 'react-helmet-async';

const APP_BRANDING = "P Trab Inteligente | by TATSUMI";

interface PageMetadataProps {
  title: string;
  description: string;
  canonicalPath: string;
}

const PageMetadata: React.FC<PageMetadataProps> = ({ title, description, canonicalPath }) => {
  // O título completo agora é sempre a marca fixa, ignorando o 'title' dinâmico.
  const fullTitle = APP_BRANDING;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={window.location.origin + canonicalPath} />
    </Helmet>
  );
};

export default PageMetadata;