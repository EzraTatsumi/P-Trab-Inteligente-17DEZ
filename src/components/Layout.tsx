import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-3xl font-extrabold text-primary">PTrab Inteligente</h1>
      </header>
      <main className="container mx-auto max-w-6xl">
        {children}
      </main>
    </div>
  );
};

export default Layout;