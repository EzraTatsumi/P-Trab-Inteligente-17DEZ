import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SessionContextProvider } from "./components/SessionContextProvider";
import { router } from "./router"; // Importa o roteador configurado
import MetadataUpdater from "./components/MetadataUpdater"; // NOVO: Importar o MetadataUpdater

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SessionContextProvider>
          <MetadataUpdater>
            <RouterProvider router={router} />
          </MetadataUpdater>
        </SessionContextProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;