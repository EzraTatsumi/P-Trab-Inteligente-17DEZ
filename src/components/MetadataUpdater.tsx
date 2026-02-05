import React from 'react';
import { HelmetProvider } from 'react-helmet-async';

interface MetadataUpdaterProps {
  children: React.ReactNode;
}

const MetadataUpdater: React.FC<MetadataUpdaterProps> = ({ children }) => {
  return (
    <HelmetProvider>
      {children}
    </HelmetProvider>
  );
};

export default MetadataUpdater;