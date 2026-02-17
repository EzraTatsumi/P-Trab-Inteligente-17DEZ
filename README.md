# PTrab Inteligente

O PTrab Inteligente é uma aplicação web desenvolvida para otimizar e automatizar o processo de criação, cálculo e gerenciamento de Planos de Trabalho (P Trabs) Logísticos e Operacionais. A ferramenta visa garantir a precisão dos custos e a conformidade com as diretrizes institucionais, facilitando o planejamento e a execução de operações.

## 1. Visão Geral da Arquitetura (Tech Stack)

O projeto é construído sobre uma arquitetura moderna e robusta, utilizando as seguintes tecnologias:

| Categoria | Tecnologias Chave | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Base para a construção da interface de usuário, garantindo tipagem e velocidade de desenvolvimento. |
| **Estilização & UI** | Tailwind CSS, shadcn/ui (Radix UI) | Estilização utilitária e componentes de interface acessíveis e reutilizáveis. |
| **Gerenciamento de Dados** | TanStack Query (React Query) | Gerenciamento de estado assíncrono (server state), caching e sincronização de dados com o backend. |
| **Backend & Autenticação** | Supabase (PostgreSQL, Auth, Edge Functions) | Banco de dados relacional, autenticação de usuários e lógica de negócios serverless. |
| **Formulários** | React Hook Form, Zod | Criação de formulários performáticos e validação de esquema robusta. |
| **Roteamento** | React Router DOM | Navegação e definição de rotas no lado do cliente. |
| **Notificações** | Sonner | Exibição de toasts e notificações. |
| **Ícones** | Lucide React | Biblioteca de ícones. |

## 2. Pré-requisitos e Configuração Inicial

Para rodar o projeto localmente, você precisará das seguintes ferramentas:

*   **Node.js:** Versão 18+
*   **npm/yarn/pnpm:** Gerenciador de pacotes de sua preferência.

### 2.1. Instalação

1.  Clone o repositório:
    ```bash
    git clone [URL_DO_REPOSITORIO]
    cd ptrab-inteligente
    ```
2.  Instale as dependências:
    ```bash
    npm install
    # ou yarn install
    # ou pnpm install
    ```

### 2.2. Variáveis de Ambiente

O projeto requer chaves de acesso ao Supabase para funcionar. Estas chaves são configuradas automaticamente pelo ambiente de desenvolvimento, mas em um ambiente de produção, você precisaria de um arquivo `.env` com:

```
VITE_SUPABASE_URL="[SUA_SUPABASE_URL]"
VITE_SUPABASE_ANON_KEY="[SUA_CHAVE_ANON]"
```

### 2.3. Inicialização

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173` (ou porta similar).

## 3. Diretrizes de Desenvolvimento

Para manter a consistência e a qualidade do código, siga rigorosamente as diretrizes abaixo:

### 3.1. UI e Estilização

*   **Componentes:** Sempre utilize os componentes do `shadcn/ui` (importados via `@/components/ui/`).
*   **Estilo:** O **Tailwind CSS** deve ser usado exclusivamente para toda a estilização. Evite estilos inline ou arquivos CSS customizados.
*   **Responsividade:** Todos os componentes devem ser projetados para serem responsivos (mobile-first).
*   **Ícones:** Use apenas ícones da biblioteca `lucide-react`.

### 3.2. Gerenciamento de Estado e Dados

*   **Server State (Dados do Banco):** Use **TanStack Query** para buscar, armazenar em cache e sincronizar dados do Supabase.
*   **Client State (UI):** Use `useState` e `useContext` para gerenciar o estado da interface do usuário.
*   **Autenticação:** Use o `SessionContextProvider` e o hook `useSession` para acessar o estado de autenticação do usuário.

### 3.3. Formulários e Validação

*   **Implementação:** Todos os formulários devem ser construídos utilizando **React Hook Form**.
*   **Validação:** A validação de esquema deve ser feita exclusivamente com o **Zod**.

### 3.4. Interação com o Backend (Supabase)

*   **Cliente:** Use o cliente Supabase configurado em `src/integrations/supabase/client.ts`.
*   **Segurança:** Lembre-se que a **Row Level Security (RLS)** está habilitada em todas as tabelas.
*   **Lógica de Negócios:** Para operações complexas (clonagem, aprovação, exclusão de usuário), utilize as **Stored Procedures (RPCs)** ou **Edge Functions** para garantir a segurança e a atomicidade das transações.

## 4. Estrutura de Arquivos

*   `src/components`: Componentes reutilizáveis da UI.
*   `src/pages`: Componentes de nível de rota (páginas).
*   `src/hooks`: Lógica reutilizável (ex: `useSession`, `useFormNavigation`).
*   `src/lib`: Funções utilitárias (formatação, tratamento de erros, etc.).
*   `src/integrations/supabase`: Configuração do cliente Supabase e tipos gerados.
*   `src/types`: Definições de tipos globais e interfaces complexas.

## 5. Contato e Suporte

Para dúvidas, sugestões, ou necessidade de suporte técnico relacionado ao desenvolvimento ou à arquitetura do projeto, por favor, entre em contato com o desenvolvedor principal:

| Nome | Contato |
| :--- | :--- |
| **Ezra Tatsumi Kimura de Moraes** | **E-mail:** ezratatsumi@hotmail.com |
| | **Telefone/WhatsApp:** (12) 99628-6303 |