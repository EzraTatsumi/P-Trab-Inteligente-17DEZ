import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './Header'; // Será criado a seguir
import { Footer } from './Footer'; // Será criado a seguir

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <Toaster richColors />
    </div>
  );
};

export default Layout;