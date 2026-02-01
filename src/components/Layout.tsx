import React from 'react';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 shadow-sm">
        <div className="container max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">P Trab Inteligente</h1>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <footer className="border-t p-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} P Trab Inteligente
      </footer>
    </div>
  );
};

export default Layout;