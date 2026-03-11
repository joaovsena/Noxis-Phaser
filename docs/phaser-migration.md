# Migracao Phaser

## Estado atual

- Novo client em `client/` usando `Phaser + TypeScript + Vite`.
- Backend Express continua sendo a entrada principal e serve `client/dist` quando o build do client existe.
- Assets e mapas existentes continuam sendo servidos de `public/`.
- `dungeon1.tmj` ja e carregado pelo client novo.
- WebSocket atual foi reaproveitado para:
  - `auth_login`
  - `auth_register`
  - `character_create`
  - `character_enter`
  - `character.back`
  - recepcao de `world_state`

## Limitacoes desta etapa

- O render atual do mapa usa placeholder isometrico via `Graphics`.
- O tileset de `dungeon1` aponta para imagens fora do repositório (`Kenney - Dungeon`), entao o client novo ainda nao renderiza sprites reais desse mapa.
- HUD, inventario, skills, party, quests, minimapa e overlays do client legado ainda nao foram portados.

## Comandos

- Build completo: `npm run build`
- Dev server do client Phaser: `npm run client:dev`
- Backend atual: `npm run dev`

## Proximo bloco de migracao

1. Internalizar ou normalizar os assets externos do tileset para o clone ficar auto-suficiente.
2. Portar sprites reais de player e NPC.
3. Migrar HUD principal e fluxo de chat.
4. Portar sistemas secundários por modulos.
