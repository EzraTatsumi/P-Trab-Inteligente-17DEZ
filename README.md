# 🛡️ PTrab Inteligente

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-amber?style=for-the-badge)
![Versão](https://img.shields.io/badge/Versão-2.0.0-blue?style=for-the-badge)
![Segurança](https://img.shields.io/badge/Segurança-Militar-green?style=for-the-badge)

> **Gestão Orçamentária, Logística e Operacional de Alta Precisão para o Exército Brasileiro.**

O **PTrab Inteligente** é uma plataforma web moderna desenvolvida para revolucionar a forma como Planos de Trabalho são criados, calculados e gerenciados. Combinando uma interface intuitiva com regras de negócio rigorosas (COLOG/COTER), a ferramenta garante conformidade, agilidade e precisão orçamentária.

---

## 📸 Visão Geral

![Dashboard Preview](https://via.placeholder.com/1200x600.png?text=Inserir+Print+da+Dashboard+Aqui)

---

## 🚀 Funcionalidades Principais

### 📊 Gestão de Planejamento
* **Cálculo Automatizado:** Regras complexas de custeio (GND 3 e 4) aplicadas automaticamente.
* **Visão Global e por OM:** Acompanhamento de saldos e despesas consolidadas ou detalhadas por Organização Militar.
* **Controle de Crédito:** Monitoramento em tempo real de teto orçamentário e saldo disponível.

### 📝 Editor de Documentos (DOR)
* **WYSIWYG Realista:** Editor visual "estilo Word" para o Documento de Oficialização de Demanda.
* **Impressão de Alta Fidelidade:** Geração de PDFs perfeitos com cabeçalhos oficiais e brasões, sem distorção.
* **Importação Inteligente:** Drag & Drop para categorizar despesas do PTrab diretamente nos grupos do DOR.

### ⚡ Performance e Usabilidade
* **Optimistic UI:** Exclusão e edição de itens com resposta instantânea, sem travar a tela.
* **Importação Excel:** Carga em lote de materiais e serviços via planilhas `.xlsx`.
* **Modo Offline First:** Visualização de dados cacheados via TanStack Query.

---

## 📚 Central de Documentação

Para aprofundamento técnico e funcional, consulte os documentos detalhados:

| Documento | Descrição |
| :--- | :--- |
| [**📘 Guia do Usuário**](./UserGuide.md) | Manual completo de uso das telas e fluxos. |
| [**🏗️ Arquitetura**](./Architecture.md) | Detalhes da Stack, estrutura de pastas e decisões técnicas. |
| [**📐 Regras de Negócio**](./BusinessRules.md) | Fórmulas de cálculo, diretrizes COLOG e lógica orçamentária. |
| [**🔒 Segurança**](./SecurityCompliance.md) | Conformidade com RLS, criptografia e proteção de dados. |

---

## 🛠️ Tech Stack

O projeto utiliza uma arquitetura moderna focada em performance e segurança:

<div align="center">

| Frontend | Backend & Data | Ferramentas |
| :---: | :---: | :---: |
| ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white) | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white) |
| ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white) | ![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white) |
| ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white) | ![Edge Functions](https://img.shields.io/badge/Edge_Functions-000?style=flat&logo=deno&logoColor=white) | ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white) |

</div>

---

## 📂 Estrutura do Projeto

```bash
src/
├── components/        # Componentes UI reutilizáveis (Botões, Cards, Dialogs)
│   ├── ui/            # Componentes base (shadcn/ui)
│   └── ...
├── pages/             # Páginas principais (Rotas)
├── hooks/             # Hooks customizados (useSession, useFormNavigation)
├── lib/               # Utilitários, formatação e lógica de exportação Excel
├── integrations/      # Cliente Supabase e Tipos Gerados
└── types/             # Definições globais de TypeScript