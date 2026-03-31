Place the HUD portraits for the in-game HP cards in this folder using these exact file names:

- `knight-male.png`
- `knight-female.png`
- `archer-male.png`
- `archer-female.png`
- `druid-male.png`
- `druid-female.png`
- `assassin-male.png`
- `assassin-female.png`

Current aliases used by the HUD:

- `shifter` uses the druid portrait
- `bandit` uses the assassin portrait

Recommended export settings:

- Canvas: `256x256`
- Final format: `PNG`
- Framing: face or bust centered
- Safe area: keep important details within the central `160x160`
- Background: dark, soft gradient, low contrast

The HUD currently renders:

- player card at `56x56`
- target player card at `26x26`

If an image is missing, the game falls back to the old class letter/avatar automatically.
