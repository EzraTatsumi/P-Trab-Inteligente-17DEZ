# Segurança e Conformidade Institucional

Este documento detalha as medidas de segurança implementadas na plataforma PTrab Inteligente.

## 1. Segurança de Dados e Autenticação

### Autenticação e Acesso
O sistema utiliza o serviço de autenticação do Supabase (JWT).
- **Verificação de E-mail:** Obrigatória para ativação da conta.
- **Gestão de Sessão:** Persistência segura no navegador com expiração controlada.

### Row Level Security (RLS)
O RLS é a espinha dorsal da proteção de dados.
- **Propriedade:** O campo `user_id` garante que apenas o criador acesse seus dados.
- **Colaboração:** Funções RPC (`request_ptrab_share`, `approve_ptrab_share`) gerenciam permissões granulares. Colaboradores só visualizam P Trabs cujos IDs constam no array `shared_with`.
- **Isolamento de Diretrizes:** As diretrizes de custeio são privadas por usuário, permitindo que cada OM/Grande Comando tenha seus próprios valores de referência.

### Criptografia e Integridade
- **Exportação/Importação:** Arquivos de backup são criptografados com **AES-256** usando uma senha definida pelo usuário.
- **Comunicação:** Todo o tráfego é realizado via HTTPS/TLS.

## 2. Conformidade e Auditoria

### Rastreabilidade
- **Logs de Alteração:** Campos `created_at` e `updated_at` em todos os registros.
- **Identificação de Origem:** P Trabs são marcados como 'original', 'importado' ou 'consolidado'.

### Conformidade COLOG / COTER
- **Cálculos Padronizados:** Implementação rigorosa das fórmulas oficiais para evitar discrepâncias em auditorias.
- **Memória de Cálculo:** Geração automática de texto descritivo detalhando cada centavo solicitado, essencial para a aprovação pelos escalões superiores.

### Proteção de Créditos (GND 3 / GND 4)
- O sistema monitora o teto orçamentário informado pelo usuário, emitindo alertas visuais quando o planejamento excede o crédito disponível.