# POC: Go Engine para calculos pesados

Este POC compara o throughput de calculos CPU-bound em:

1. JS/TS no processo Node.
2. Go em microservico dedicado (`engine-go`) com chamadas HTTP em lote.

O objetivo e validar ganho de performance e escalabilidade no seu servidor Debian 13 com **4 vCPU / 4 GB RAM**.

## O que foi implementado

- `engine-go` com endpoints:
  - `POST /v1/combat/batch`: calcula dano mitigado em lote.
  - `POST /v1/path/batch`: calcula pathfinding (A*) em lote.
- Script benchmark:
  - `scripts/bench_engine_poc.js`
  - Mede tempo total, ops/s e checksum para consistencia.

## Como executar no Debian 13

No servidor:

```bash
cd /caminho/do/projeto
docker compose --profile poc up --build -d engine-go
npm run bench:engine:poc
```

Para parar:

```bash
docker compose --profile poc down
```

## Parametros uteis do benchmark

Variaveis de ambiente:

- `BENCH_COMBAT_CASES` (default: `300000`)
- `BENCH_PATH_CASES` (default: `1200`)
- `BENCH_GO_BATCH_SIZE` (default: `2000`)
- `BENCH_GO_CONCURRENCY` (default: `8`)
- `ENGINE_URL` (default: `http://localhost:8088`)

Exemplo mais pesado (servidor 4 vCPU):

```bash
BENCH_COMBAT_CASES=1000000 BENCH_PATH_CASES=4000 BENCH_GO_BATCH_SIZE=4000 BENCH_GO_CONCURRENCY=12 npm run bench:engine:poc
```

## Como interpretar

O script imprime:

- `JS local`: baseline no processo Node.
- `Go engine`: throughput do microservico Go (incluindo overhead de rede HTTP local).
- `Speedup Go/JS`: ganho relativo.

Se o ganho ficar consistente (>1.5x ou 2x nos seus cenarios), o proximo passo e mover gradualmente:

1. pathfinding,
2. combate/aggro,
3. tick de IA de mobs.

## Observacoes

- Este POC mede apenas kernel de calculo e overhead de chamada.
- Nao substitui profiling do servidor completo com jogadores reais.
- Em carga alta, o maior ganho nao e so throughput: e manter o event loop Node livre para WebSocket e IO.
