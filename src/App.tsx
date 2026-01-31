import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { PTrabProvider } from './context/PTrabContext';
import ClasseIForm from './pages/ClasseIForm';
import Layout from './components/Layout'; // Assumindo que existe um Layout

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PTrabProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Rota de exemplo para o formulário Classe I */}
              <Route path="/ptrab/:ptrabId/classe-i" element={<ClasseIForm />} />
              
              {/* Adicione outras rotas aqui, como a página inicial ou o PTrabReportManager */}
              <Route path="/" element={<div>Página Inicial / Dashboard</div>} />
            </Routes>
          </Layout>
        </Router>
        <Toaster richColors />
      </PTrabProvider>
    </QueryClientProvider>
  );
}

export default App;