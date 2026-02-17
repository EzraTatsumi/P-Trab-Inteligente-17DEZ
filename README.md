# 🛡️ PTrab Inteligente

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-amber?style=for-the-badge)
![Versão](https://img.shields.io/badge/Versão-2.0.0-blue?style=for-the-badge)
![Segurança](https://img.shields.io/badge/Segurança-Militar-green?style=for-the-badge)

> **Gestão Orçamentária, Logística e Operacional de Alta Precisão para o Exército Brasileiro.**

O **PTrab Inteligente** é uma plataforma web moderna desenvolvida para revolucionar a forma como Planos de Trabalho são criados, calculados e gerenciados. Combinando uma interface intuitiva com regras de negócio rigorosas (COLOG/COTER), a ferramenta garante conformidade, agilidade e precisão orçamentária.

---

## 🚀 Funcionalidades Principais

### 📊 Gestão de Planejamento
* **Cálculo Automatizado:** Regras complexas de custeio (GND 3 e 4) aplicadas automaticamente conforme diretrizes vigentes.
* **Visão Global e por OM:** Acompanhamento de saldos e despesas consolidadas ou detalhadas por Organização Militar participante.
* **Controle de Crédito:** Monitoramento em tempo real de teto orçamentário e saldo disponível para evitar extrapolação de recursos.

### 📝 Editor de Documentos (DOR)
* **WYSIWYG Realista:** Editor visual para o Documento de Oficialização de Demanda com formatação em tempo real.
* **Impressão de Alta Fidelidade:** Geração de PDFs e planilhas Excel com cabeçalhos oficiais e brasões, garantindo padronização.
* **Integração de Dados:** Sincronização direta entre os lançamentos do PTrab e os grupos de despesa do DOR.

### ⚡ Performance e Usabilidade
* **Optimistic UI:** Interface reativa que permite edição e exclusão de itens com resposta instantânea.
* **Integração PNCP:** Busca em tempo real de estatísticas de preço e Atas de Registro de Preços (ARP) via API do Governo Federal.
* **Gestão de Diretrizes:** Sistema flexível de importação e exportação de tabelas de custos anuais.

---

## 📚 Central de Documentação

Para aprofundamento técnico e funcional, consulte os documentos detalhados:

| Documento | Descrição |
| :--- | :--- |
| [**📘 Guia do Usuário**](src/docs/UserGuide.md) | Manual completo de uso das telas, fluxos e gerenciador de impressão. |
| [**🏗️ Arquitetura**](src/docs/Architecture.md) | Detalhes da Stack, estrutura de pastas e decisões técnicas. |
| [**📐 Regras de Negócio**](src/docs/BusinessRules.md) | Fórmulas de cálculo, diretrizes COLOG/COTER e lógica orçamentária. |
| [**🔒 Segurança**](src/docs/SecurityCompliance.md) | Conformidade com RLS, criptografia e proteção de dados sensíveis. |

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
├── docs/              # Documentação técnica e funcional (Markdown)
├── pages/             # Páginas principais e rotas da aplicação
├── hooks/             # Hooks customizados para lógica de estado e navegação
├── lib/               # Utilitários de formatação, cálculos e exportação
├── integrations/      # Cliente Supabase, APIs externas e tipos gerados
└── types/             # Definições globais de tipos TypeScript