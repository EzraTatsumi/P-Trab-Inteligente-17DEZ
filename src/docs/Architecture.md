# Arquitetura do PTrab Inteligente

Este documento descreve a arquitetura técnica do projeto PTrab Inteligente, focando na pilha de tecnologia e nos padrões de interação entre o cliente e o servidor.

## 1. Pilha Tecnológica (Tech Stack)

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Interface de usuário e lógica de apresentação. |
| **Estilização** | Tailwind CSS, shadcn/ui | Design system e componentes de UI. |
| **Roteamento** | React Router DOM | Gerenciamento de rotas e navegação no lado do cliente (configurado em `src/router.tsx`). |
| **Backend/DB** | Supabase (PostgreSQL) | Banco de dados, autenticação (Auth) e funções de backend (Edge Functions). |
| **Server State** | TanStack Query (React Query) | Gerenciamento de estado assíncrono, caching e sincronização. |
| **Formulários** | React Hook Form + Zod | Criação de formulários controlados e validação de esquema. |
| **Notificações** | Sonner | Exibição de toasts e mensagens transientes. |

## 2. Estrutura de Diretórios

- `src/pages`: Componentes de rota (`/ptrab`, `/ptrab/form`, `/ptrab/dor`, etc.).
- `src/components`: Componentes reutilizáveis e lógica de UI.
- `src/integrations/supabase`: Cliente Supabase, tipos e funções de API (`api.ts`).
- `src/hooks`: Hooks customizados (ex: `useFormNavigation`).
- `src/lib`: Utilitários (formatação, cálculos, gerenciamento de créditos).
- `src/types`: Definições de interfaces TypeScript.
- `src/docs`: Documentação técnica e funcional em Markdown.

## 3. Fluxo de Dados e Gerenciamento de Estado

### A. Estado do Servidor (Server State)
Gerenciado pelo **TanStack Query**. As mutações invalidam o cache para garantir que a UI reflita os dados mais recentes do Supabase após inserções ou atualizações.

### B. Estado do Cliente (Client State)
- **Autenticação:** Centralizada no `SessionContextProvider`.
- **Créditos Orçamentários:** Gerenciados via `creditUtils.ts` e persistidos no perfil do usuário.

## 4. Interação com Supabase e APIs Externas

### Segurança (RLS)
Todas as tabelas possuem **Row Level Security (RLS)**. O acesso é restrito ao proprietário (`user_id`) ou colaboradores autorizados (`shared_with`).

### Edge Functions (Deno)
Utilizadas para operações que exigem segurança ou contorno de CORS:
- **fetch-fuel-prices:** Busca preços médios de combustíveis (LPC).
- **fetch-arps-by-uasg / fetch-arp-items:** Integração com o **PNCP** para buscar Atas de Registro de Preços.
- **fetch-catmat-details:** Busca descrições detalhadas de itens no catálogo do Governo Federal.
- **AI Chat:** Interface com modelos de linguagem (Gemini) para o assistente virtual.

## 5. Convenções de Código
- **Tipagem:** Uso estrito de TypeScript para evitar erros em tempo de execução.
- **UI:** Componentes baseados em Radix UI via `shadcn/ui`.
- **Responsividade:** Design "mobile-first" adaptado para desktops.