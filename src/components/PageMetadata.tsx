import React from 'react';
import { Helmet } from 'react-helmet-async';

interface PageMetadataProps {
  title: string;
  description: string;
  canonicalPath: string;
}

const PageMetadata: React.FC<PageMetadataProps> = ({ title, description, canonicalPath }) => {
  const fullTitle = `${title} | PTrab Inteligente`;
  const baseUrl = window.location.origin;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
    </Helmet>
  );
};

export default PageMetadata;