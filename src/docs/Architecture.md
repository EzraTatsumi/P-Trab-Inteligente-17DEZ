# Arquitetura Técnica

O PTrab Inteligente é uma aplicação moderna baseada em microserviços e computação em nuvem.

## 1. Stack Tecnológica
- **Frontend:** React com TypeScript e Vite.
- **UI/UX:** Tailwind CSS e Shadcn/UI para componentes consistentes.
- **Backend:** Supabase (PostgreSQL, Auth, Storage).
- **Edge Functions:** Funções serverless em Deno para integrações externas.

## 2. Integrações Externas (Edge Functions)
- **API PNCP:** Busca e processamento de dados de licitações e ARPs diretamente do governo federal.
- **Preços de Combustíveis:** Scraping/API para atualização automática de valores de referência.
- **Conversão de Documentos:** Processamento de HTML para PDF e geração de arquivos Excel complexos.

## 3. Modelo de Dados
O banco de dados utiliza **Row Level Security (RLS)** para garantir que cada usuário (ou colaborador autorizado) acesse apenas seus próprios dados. As tabelas são normalizadas para separar o cabeçalho do PTrab dos registros específicos de cada classe logística ou item operacional.

## 4. Sincronização em Tempo Real
Utilizamos **TanStack Query** para cache e sincronização de estado, garantindo que o resumo de custos reflita as alterações imediatamente após a gravação no banco de dados.