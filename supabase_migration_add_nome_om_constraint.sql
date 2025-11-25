ALTER TABLE public.organizacoes_militares
ADD CONSTRAINT organizacoes_militares_user_id_nome_om_key UNIQUE (user_id, nome_om);