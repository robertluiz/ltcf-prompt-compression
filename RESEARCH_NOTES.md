# Notas de pesquisa — dimensionamento do índice

## Decisão

O índice não deve ter cardinalidade fixa. A configuração recomendada é:

```text
pool disponível: 64 aliases de 1 token
entradas enviadas: apenas as de ganho marginal positivo
comprimento máximo (`balanced`): escolhido entre 8, 16 e 32 tokens
comprimento máximo (`aggressive`): escolhido entre 16, 32 e 48 tokens
fallback: enviar o original quando o prompt completo não ficar menor
```

## Critério exato

Para um dicionário `D`:

```text
J(D) = tokenCount(contract + render(D) + encode(text, D))
```

Uma entrada é aceita quando:

```text
J(D ∪ {entry}) < J(D)
```

O algoritmo para quando o melhor candidato restante falha nessa desigualdade.
Isso implementa o equilíbrio entre a capacidade do índice e o custo de descrevê-lo.

## Por que não usar um índice fixo de palavras

O tokenizer BPE já possui tokens para palavras e fragmentos comuns. Um segundo
índice genérico costuma duplicar esse vocabulário. O ganho aparece em sequências
multitoken específicas do lote, como templates de log, caminhos, campos JSON,
assinaturas de função e instruções repetidas.

## Evidências usadas

1. Campos et al. formalizam a condição de economia incluindo o custo da entrada
   no dicionário e mostram que alguns datasets têm um `Lmax` ótimo; valores maiores
   podem reduzir o ganho por causa do overhead.
2. O mesmo trabalho recomenda dicionários por lote para capturar os padrões que
   realmente aparecem naquele contexto.
3. SMAZ mostra que um codebook estático pequeno pode funcionar em textos curtos,
   mas seu desempenho é fortemente dependente do domínio e idioma.
4. Brotli mostra o outro extremo: um dicionário grande funciona quando está
   embutido no decoder e, portanto, não precisa acompanhar cada mensagem.

## Interpretação dos benchmarks

```text
logs: 5 entradas bastaram
prosa repetitiva: 2 entradas no `balanced`; 1 frase longa no `aggressive`
código: 42 entradas ainda produziram ganho líquido
texto curto: nenhuma entrada; envio sem wrapper
```

Isso demonstra por que um número fixo como 8, 16 ou 32 não maximiza todos os
casos. O teto de 64 oferece espaço ao código sem cobrar esse espaço nos casos que
terminam com 1–5 entradas.
