# Taxas · Sílvia Novaes

Controle das taxas das maquininhas de cartão da loja: lançar vendas, comparar máquinas, taxas por bandeira e resumo do mês.

- Site estático (GitHub Pages) com login e dados no Supabase da loja (`supabase/schema.sql`).
- Os dados da loja não ficam neste repositório: só no banco, protegidos por RLS.
- `.github/workflows/supabase-keepalive.yml` chama o banco uma vez por dia para o projeto grátis não pausar.
