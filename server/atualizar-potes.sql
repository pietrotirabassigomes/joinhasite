BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

INSERT OR IGNORE INTO products
  (id,nome,categoria,imagem,tamanhos,upgrades,obs,ativo,criado_em,atualizado_em)
VALUES
  ('pote-bombom-branco','Bombom Branco','potes','/CARDAPIO/joinha_potes_recortes/11_napolitano_bombom_branco.webp','[{"nome":"Pote 2L","preco":33}]','[{"nome":"Cobertura","preco":0},{"nome":"Chantilly","preco":3}]',1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('pote-bombom','Bombom','potes','/CARDAPIO/joinha_potes_recortes/13_chocolate_trufado_bombom.webp','[{"nome":"Pote 2L","preco":33}]','[{"nome":"Cobertura","preco":0},{"nome":"Chantilly","preco":3}]',1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('pote-chocolate','Chocolate','potes','/CARDAPIO/joinha_potes_recortes/12_chocolate_trufado.webp','[{"nome":"Pote 2L","preco":30}]','[{"nome":"Cobertura","preco":0},{"nome":"Chantilly","preco":3}]',1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));

UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-abacaxi-suico';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":30}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-coco-branco';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-maracuja-trufado';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-unicornio';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-ferrero-rocher-com-avela';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-pistache';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":30}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-creme';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":30}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-napolitano';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-chocolate-trufado';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-olho-de-sogra';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-trufado-provocante';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-provocante-avela';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":30}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-flocos';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-acai-puro';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-floresta-suprema';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":50}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-iogurte-com-morango';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-chocomenta';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":38}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='pote-super-chocolate';

UPDATE products SET ativo=1, tamanhos='[{"nome":"Pote 2L","preco":50}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id IN ('pote-abacaxi-suico-com-chocolate','pote-maracuja-trufado-unicornio','pote-olho-de-sogra-trufado');
UPDATE products SET ativo=1, tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='pote-iogurte-com-morango-frutas-vermelhas';
UPDATE products SET ativo=0, atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id IN ('pote-napolitano-bombom-branco','pote-chocolate-trufado-bombom');
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='pote-bombom-branco';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":33}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='pote-bombom';
UPDATE products SET tamanhos='[{"nome":"Pote 2L","preco":30}]', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='pote-chocolate';

INSERT INTO schema_migrations (name, applied_at)
VALUES ('potes-precos-2l-v1', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
COMMIT;
