# Noxis - Jogo MMO 2D

Noxis é um jogo MMO 2D desenvolvido em Node.js com TypeScript, utilizando WebSockets para comunicação em tempo real e PostgreSQL para persistência de dados.

## Funcionalidades

- Autenticação de usuários (registro e login)
- Movimentação de jogadores e mobs
- Sistema de combate automático
- Inventário e equipamentos
- Chat local, de mapa e global
- Múltiplas instâncias de mapa
- Logs de servidor

## Estrutura do Projeto

```
server/
  config/          # Constantes e configurações
  controllers/     # Manipuladores de mensagens WS
  models/          # Tipos TypeScript e interfaces
  services/        # Lógica de negócio (mobs, persistência)
  utils/           # Funções utilitárias (hash, math, logger)
prisma/
  schema.prisma    # Esquema do banco de dados
public/            # Cliente web (HTML, CSS, JS)
tests/             # Testes unitários
```

## Pré-requisitos

- Node.js 16+
- PostgreSQL 13+
- npm ou yarn

## Instalação

1. Clone o repositório:
   ```bash
   git clone <url>
   cd noxis
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o banco de dados PostgreSQL:
   - Instale e inicie o PostgreSQL
   - Crie um banco de dados chamado `noxis`
   - Copie `.env.example` para `.env` e configure a variável `DATABASE_URL`:
     ```
     DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/noxis"
     ```

4. Execute as migrações do Prisma:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. Compile o TypeScript:
   ```bash
   npm run build
   ```

6. Inicie o servidor:
   ```bash
   npm start
   ```

O servidor estará rodando em `http://localhost:3000`.

## Desenvolvimento

- Para desenvolvimento com hot-reload:
  ```bash
  npm run dev
  ```

- Para executar testes:
  ```bash
  npm test
  ```

## Rodar com Docker (app + banco)

Este projeto possui `docker-compose.yml` com dois serviÃ§os:
- `db` (PostgreSQL 16) com volume persistente `noxis_postgres_data`
- `app` (Node.js) em `http://localhost:3000`

Subir tudo:
```bash
docker compose up --build -d
```

Ver logs:
```bash
docker compose logs -f
```

Parar sem apagar dados:
```bash
docker compose down
```

Se usar `docker compose down -v`, o volume do banco Ã© removido e os dados serÃ£o perdidos.

## API WebSocket

### Mensagens de Autenticação

- `auth_register`: { username, password, name, class }
- `auth_login`: { username, password }

### Mensagens de Jogo

- `move`: { reqId?, x, y }
- `target_mob`: { mobId }
- `pickup_item`: { itemId }
- `equip_item`: { itemId }
- `inventory_move`: { itemId, toSlot }
- `inventory_sort`: {}
- `inventory_delete`: { itemId }
- `switch_instance`: { mapId }
- `admin_command`: { command }

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT.

## Estrutura Modular

O código foi refatorado para uma arquitetura modular:

- **server/config/**: Constantes e configurações.
- **server/models/**: Tipos TypeScript e interfaces de mensagens.
- **server/services/**: Lógica de negócio (persistência, mobs).
- **server/controllers/**: Manipuladores de mensagens WS.
- **server/utils/**: Funções utilitárias (hash, math, logger).
- **prisma/**: Esquema do banco de dados.

## Generalização de Renderização

No cliente, criei classes `Entity`, `SpriteEntity` e `ShapeEntity` para padronizar a renderização. Jogadores e mobs agora herdam de `Entity`, permitindo trocar facilmente entre sprites e formas geométricas sem alterar o código principal.

## Segurança e Melhorias

- Migração para TypeScript para tipagem forte.
- Integração com PostgreSQL via Prisma para persistência robusta.
- Validação de mensagens WS com tipos.
- Logs estruturados no banco.

## Rodar em duas portas (estavel + desenvolvimento)

O servidor aceita a variavel de ambiente `PORT`.

Exemplo no PowerShell (2 terminais):

```powershell
# Terminal 1: servidor estavel (build)
$env:PORT=3000
npm start
```

```powershell
# Terminal 2: servidor de desenvolvimento (reinicia a cada alteracao)
$env:PORT=3001
npm run dev
```

Abra o jogo em:
- Estavel: `http://localhost:3000`
- Desenvolvimento: `http://localhost:3001`

## Docker Compose separado (prod e dev)

Subir producao (porta 3000):
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Subir desenvolvimento (porta 3001, com reload):
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Parar cada ambiente:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.dev.yml down
```
