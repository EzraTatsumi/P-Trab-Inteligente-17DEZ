# Segurança e Conformidade Institucional

Este documento detalha as medidas de segurança e o alinhamento com as diretrizes do Exército Brasileiro.

## 1. Segurança de Dados e Autenticação
- **Autenticação JWT:** Gerenciada pelo Supabase Auth.
- **Row Level Security (RLS):** Garante isolamento total entre usuários. Um usuário "A" jamais verá os dados do usuário "B", a menos que haja um compartilhamento explícito.
- **Compartilhamento por Token:** O acesso colaborativo é baseado em um `share_token` único por PTrab. O proprietário deve aprovar manualmente cada solicitação de vínculo.

## 2. Criptografia e Backup
- **AES-256:** Utilizada na exportação de arquivos de backup. A senha definida pelo usuário é a única chave capaz de descriptografar os dados para reimportação.
- **Proteção de Segredos:** Chaves de API (como a do Gemini ou ANP) são armazenadas como segredos no Supabase e acessadas apenas via Edge Functions, nunca expostas no frontend.

## 3. Conformidade Institucional
- **Rastreabilidade:** Cada alteração atualiza o campo `updated_at`, permitindo auditoria da última modificação.
- **Padronização:** Os relatórios em PDF e Excel seguem rigorosamente os modelos previstos nas diretrizes de planejamento orçamentário.
- **Privacidade:** Dados sensíveis de perfil (como CPF ou senhas) não são armazenados de forma legível ou acessível por outros usuários.