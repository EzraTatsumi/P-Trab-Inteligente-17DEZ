# 🛡️ PTrab Inteligente

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-amber?style=for-the-badge)
![Versão](https://img.shields.io/badge/Versão-2.0.0-blue?style=for-the-badge)
![Segurança](https://img.shields.io/badge/Segurança-Militar-green?style=for-the-badge)

> **Gestão Orçamentária, Logística e Operacional de Alta Precisão para o Exército Brasileiro.**

O **PTrab Inteligente** é uma plataforma web moderna desenvolvida para revolucionar a forma como Planos de Trabalho são criados, calculados e gerenciados. Combinando uma interface intuitiva com regras de negócio rigorosas (COLOG/COTER), a ferramenta garante conformidade, agilidade e precisão orçamentária.

---

## 🚀 Funcionalidades Principais

*   **Cálculo Automatizado:** Regras complexas de custeio (GND 3 e 4) aplicadas automaticamente.
*   **Editor de Documentos (DOR):** Geração de PDFs oficiais e planilhas Excel padronizadas.
*   **Integração PNCP:** Estatísticas de preço e busca de ARPs em tempo real.
*   **Colaboração Segura:** Compartilhamento de PTrabs entre usuários com controle de acesso.

---

## 📖 Como acessar a Documentação?

A documentação completa está disponível de duas formas:

### 1. Dentro do Aplicativo (Para o Usuário Final)
Ao navegar no sistema, clique no ícone de **Interrogação (Ajuda)** localizado na barra de ferramentas da tela principal (Gerenciador de PTrabs). Isso abrirá a **Central de Ajuda**, onde você encontrará:
*   Guia do Usuário interativo.
*   Regras de Negócio detalhadas.
*   Informações de Segurança e Arquitetura.

### 2. No Repositório (Para Desenvolvedores)
Os arquivos fonte da documentação estão localizados em `src/docs/`:

| Documento | Link Direto |
| :--- | :--- |
| **📘 Guia do Usuário** | [Visualizar](./src/docs/UserGuide.md) |
| **📐 Regras de Negócio** | [Visualizar](./src/docs/BusinessRules.md) |
| **🏗️ Arquitetura** | [Visualizar](./src/docs/Architecture.md) |
| **🔒 Segurança** | [Visualizar](./src/docs/SecurityCompliance.md) |

---

## 🛠️ Tech Stack

<div align="center">

| Frontend | Backend & Data | Ferramentas |
| :---: | :---: | :---: |
| ![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB) | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white) | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white) |
| ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white) | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white) | ![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white) |
| ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white) | ![Edge Functions](https://img.shields.io/badge/Edge_Functions-000?style=flat&logo=deno&logoColor=white) | ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white) |

</div>

---

## 📞 Contato e Suporte

Para reportar falhas, sugerir melhorias ou solicitar suporte técnico:

*   **Desenvolvedor Responsável:** Ezra Tatsumi Kimura de Moraes
*   **Contato Telefônico: (12) 99628-6303 - Whatsapp**
*   **E-mail:** ezratatsumi@hotmail.com
*   **Feedback:** Utilize o botão "Reportar Falha" dentro da Central de Ajuda no app.

---

## 📂 Estrutura do Projeto

```bash
src/
├── components/        # Componentes UI e Central de Ajuda
├── docs/              # Arquivos Markdown da documentação
├── pages/             # Telas da aplicação
├── lib/               # Lógica de cálculo e utilitários
└── integrations/      # Conexão com Supabase e APIs