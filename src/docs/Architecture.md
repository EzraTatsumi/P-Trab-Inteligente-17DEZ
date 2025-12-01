## Arquitetura do PTrab Inteligente

Este documento descreve a arquitetura técnica do projeto PTrab Inteligente, focando na pilha de tecnologia e nos padrões de interação entre o cliente e o servidor.

## 1. Pilha Tecnológica (Tech Stack)

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Interface de usuário e lógica de apresentação. |
| **Estilização** | Tailwind CSS, shadcn/ui | Design system e componentes de UI. |
| **Roteamento** | React Router DOM | Gerenciamento de rotas e navegação no lado do cliente. |
| **Backend/DB** | Supabase (PostgreSQL) | Banco de dados, autenticação (Auth) e funções de backend (Edge Functions). |
| **Server State** | TanStack Query (React Query) | Gerenciamento de estado assíncrono, caching, sincronização e otimizações de requisição. |
| **Formulários** | React Hook Form + Zod | Criação de formulários controlados e validação de esquema. |
| **Notificações** | Sonner | Exibição de toasts e mensagens transientes. |

## 2. Estrutura de Diretórios

A estrutura de diretórios segue o padrão de projetos React/Vite, com foco na separação de responsabilidades:

- `src/pages`: Componentes de nível superior que representam rotas (`/ptrab`, `/login`, etc.).
- `src/components`: Componentes reutilizáveis de UI e lógica de aplicação.
- `src/integrations/supabase`: Configuração do cliente Supabase e tipos de banco de dados.
- `src/hooks`: Lógica reutilizável de estado e efeitos (ex: `useSession`, `useFormNavigation`).
- `src/lib`: Funções utilitárias de propósito geral (formatação, validação, criptografia).
- `src/data`: Dados estáticos ou configurações padrão (ex: `classeIIIData`).
- `src/types`: Definições de tipos TypeScript para interfaces de dados.
- `src/docs`: Documentação interna do projeto.

## 3. Fluxo de Dados e Gerenciamento de Estado

O projeto adota uma abordagem de gerenciamento de estado híbrida:

### A. Estado do Servidor (Server State)

Todo o estado que reside no banco de dados (PTrabs, Registros, Diretrizes, Perfis) é gerenciado pelo **TanStack Query**.

- **Padrão de Interação:**
    1. Componentes usam `useQuery` para buscar dados do Supabase.
    2. As funções de busca (`queryFn`) utilizam o cliente Supabase (`supabase.from('table').select('*')`).
    3. Mutações (`useMutation`) são usadas para operações de escrita (INSERT, UPDATE, DELETE).
    4. Após uma mutação bem-sucedida, `queryClient.invalidateQueries` é chamado para garantir que os dados em cache sejam revalidados e atualizados automaticamente na UI.

### B. Estado do Cliente (Client State)

- **Autenticação:** Gerenciada pelo `supabase.auth` e exposta via `SessionContextProvider` e `useSession`.
- **UI Local:** Gerenciada por `useState` (ex: estado de inputs, abertura de modais).
- **Formulários:** Gerenciados pelo `react-hook-form`.

## 4. Interação com Supabase

### Cliente Supabase

O cliente é inicializado em `src/integrations/supabase/client.ts` e utiliza variáveis de ambiente para URL e chave pública.

### Segurança (RLS)

A segurança é mandatória. Todas as tabelas de dados do usuário (`p_trab`, `classe_i_registros`, `organizacoes_militares`, etc.) possuem **Row Level Security (RLS)** habilitada.

- **Regra Padrão:** Usuários autenticados só podem `SELECT`, `INSERT`, `UPDATE` e `DELETE` em registros onde `auth.uid() = user_id` ou onde há uma relação de chave estrangeira que garante a posse do registro (ex: `p_trab_id` referenciando um `p_trab` que pertence ao `auth.uid()`).

### Edge Functions (Deno)

Para lógica de backend mais complexa, como integração com APIs externas ou manipulação de segredos, são utilizadas Supabase Edge Functions (escritas em TypeScript/Deno).

## 5. Convenções de Código

- **TypeScript:** Uso rigoroso de tipagem para todas as funções e componentes.
- **Componentes:** Prioridade para `shadcn/ui`. Novos componentes devem ser pequenos, focados e estilizados exclusivamente com Tailwind CSS.
- **Internacionalização:** O idioma principal é o Português do Brasil (pt-BR).