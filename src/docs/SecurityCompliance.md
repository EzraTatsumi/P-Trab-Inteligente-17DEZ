# Segurança e Conformidade

A proteção dos dados de planejamento militar é nossa prioridade máxima.

## 1. Controle de Acesso
- **Autenticação:** Gerenciada via Supabase Auth com suporte a tokens JWT.
- **Autorização:** Políticas de RLS (Row Level Security) impedem o acesso não autorizado a nível de linha no banco de dados.

## 2. Compartilhamento Seguro
O sistema de compartilhamento utiliza tokens únicos (UUID) e um fluxo de solicitação/aprovação. O proprietário do PTrab mantém controle total sobre quem pode visualizar ou editar os dados.

## 3. Integridade dos Dados
- **Audit Logs:** Cada alteração registra o timestamp de atualização.
- **Backups:** O banco de dados PostgreSQL conta com backups automáticos e point-in-time recovery.

## 4. Privacidade
Nenhum dado sensível de planejamento é compartilhado com terceiros. As integrações com a API do PNCP são apenas de leitura (consumo de dados públicos).