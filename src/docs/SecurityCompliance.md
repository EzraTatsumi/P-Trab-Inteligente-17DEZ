# Segurança e Conformidade Institucional

Este documento detalha as medidas de segurança implementadas na plataforma PTrab Inteligente e o alinhamento com as diretrizes de segurança e conformidade do Exército Brasileiro.

## 1. Segurança de Dados e Autenticação

A segurança dos dados é a prioridade máxima, utilizando o Supabase como backend seguro.

### Autenticação e Acesso
O sistema utiliza o serviço de autenticação do Supabase, que é baseado em JWT (JSON Web Tokens).

- **Sessões Seguras:** As sessões são persistidas e gerenciadas de forma segura no lado do cliente.
- **Verificação de E-mail:** A criação de contas exige a confirmação de e-mail para garantir a validade do usuário.

### Row Level Security (RLS)
O RLS é a principal camada de proteção contra acesso não autorizado aos dados.

- **Princípio do Mínimo Privilégio:** Usuários só podem acessar, modificar ou excluir os registros que eles próprios criaram.
- **Colaboração Segura:** Políticas RLS específicas (`is_ptrab_owner_or_shared`) garantem que colaboradores convidados (via `shared_with` array) tenham permissão de leitura e escrita apenas nos P Trabs compartilhados.
- **Proteção de Perfis:** Políticas RLS garantem que apenas o proprietário do P Trab ou o próprio colaborador possa visualizar os dados de perfil relacionados ao compartilhamento.

### Criptografia de Exportação e Importação
Para garantir a confidencialidade dos dados exportados (backup de P Trabs), é utilizada a criptografia AES-256.

- **Criptografia AES:** O arquivo JSON exportado é criptografado usando uma senha fornecida pelo usuário e uma chave secreta (salt) derivada via PBKDF2.
- **Proteção Offline:** O arquivo só pode ser descriptografado e importado novamente se a senha correta for fornecida.

## 2. Conformidade e Auditoria

O PTrab Inteligente foi desenvolvido para atender aos requisitos de rastreabilidade e padronização exigidos pelos órgãos de controle.

### Conformidade COLOG / COTER
Os cálculos e a estrutura de dados são baseados nas diretrizes de custeio logístico e operacional mais recentes.

- **Cálculos Padronizados:** As fórmulas de Classe I, II, III, V, VI, VII, VIII e IX são implementadas conforme as normas, minimizando erros humanos.
- **Memória de Cálculo:** O sistema gera automaticamente a memória de cálculo detalhada para cada registro, fornecendo a justificativa completa para auditoria.

### Rastreabilidade e Logs
O banco de dados registra metadados essenciais para auditoria.

- **Timestamps:** Campos `created_at` e `updated_at` registram o momento exato da criação e da última modificação de cada registro.
- **Propriedade do Registro:** O campo `user_id` em todas as tabelas principais permite rastrear o responsável pela criação do dado.

### Exportação em Formato Oficial
A exportação para PDF e Excel é formatada para replicar o layout dos documentos oficiais, facilitando a submissão e a análise pelos escalões superiores.