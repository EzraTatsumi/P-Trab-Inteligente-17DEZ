# Arquitetura do PTrab Inteligente

Este documento descreve a arquitetura técnica do projeto PTrab Inteligente, focando na pilha de tecnologia e nos padrões de interação entre o cliente e o servidor.

## 1. Pilha Tecnológica (Tech Stack)

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Interface de usuário e lógica de apresentação. |
| **Estilização** | Tailwind CSS, shadcn/ui | Design system e componentes de UI. |
| **Roteamento** | React Router DOM | Gerenciamento de rotas e navegação no lado do cliente (v7). |
| **Backend/DB** | Supabase (PostgreSQL) | Banco de dados, autenticação (Auth) e funções de backend (Edge Functions). |
| **Server State** | TanStack Query (React Query) | Gerenciamento de estado assíncrono, caching e sincronização. |
| **Formulários** | React Hook Form + Zod | Criação de formulários controlados e validação de esquema. |
| **Notificações** | Sonner | Exibição de toasts e mensagens transientes. |

## 2. Estrutura de Diretórios

A estrutura de diretórios segue o padrão de projetos React/Vite, com foco na separação de responsabilidades:

- `src/pages`: Componentes de nível superior que representam rotas (`/ptrab`, `/ptrab/dor`, etc.).
- `src/components`: Componentes reutilizáveis de UI e lógica de aplicação (incluindo diálogos de importação e rows de drag-and-drop).
- `src/integrations/supabase`: Configuração do cliente Supabase, tipos de banco de dados e funções de API.
- `src/hooks`: Lógica reutilizável de estado e efeitos (ex: `useMaterialConsumoDiretrizes`, `useSession`).
- `src/lib`: Funções utilitárias (formatação, cálculos de crédito GND3/GND4, exportação Excel).
- `src/types`: Definições de tipos TypeScript para interfaces de dados (Diretrizes, Itens, PTrab).
- `src/docs`: Documentação interna do projeto.

## 3. Fluxo de Dados e Gerenciamento de Estado

O projeto adota uma abordagem de gerenciamento de estado híbrida:

### A. Estado do Servidor (Server State)

Todo o estado que reside no banco de dados (PTrabs, Registros, Diretrizes, Perfis) é gerenciado pelo **TanStack Query**.

- **Padrão de Interação:**
    1. Componentes usam `useQuery` para buscar dados do Supabase.
    2. Mutações (`useMutation`) são usadas para operações de escrita.
    3. Após uma mutação, `queryClient.invalidateQueries` garante a atualização automática da UI.
    4. **Otimização:** Algumas telas utilizam estados locais sincronizados para permitir atualizações instantâneas (Optimistic UI), como na movimentação de itens.

### B. Estado do Cliente (Client State)

- **Autenticação:** Gerenciada pelo `supabase.auth` e exposta via `SessionContextProvider`.
- **UI Local:** Gerenciada por `useState` e `useContext`.
- **Drag and Drop:** Implementado nativamente para permitir a movimentação de itens entre subitens de diretrizes.

## 4. Interação com Supabase

### Segurança (RLS)

A segurança é mandatória. Todas as tabelas possuem **Row Level Security (RLS)** habilitada.

- **Colaboração:** Funções PostgreSQL (`request_ptrab_share`, `approve_ptrab_share`) gerenciam o acesso colaborativo via array `shared_with`.

### Edge Functions (Deno)

- **Integração PNCP:** Funções para buscar ARPs e itens diretamente do Portal Nacional de Contratações Públicas.
- **Preços de Combustível:** Busca automatizada de preços médios (LPC).
- **Assistente de IA:** Processamento de chat com o modelo Gemini.

## 5. Convenções de Código

- **TypeScript:** Uso rigoroso de tipagem.
- **Componentes:** Prioridade para `shadcn/ui`. Componentes de formulário são divididos em diálogos focados.
- **Internacionalização:** Idioma principal: Português do Brasil (pt-BR).