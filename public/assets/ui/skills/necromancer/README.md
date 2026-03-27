`skills.png` e a sheet fonte dos icones do necromante.

Os recortes finais ficam em `icons/`.
Esses assets sao exclusivos do necromante e nao devem ser usados pelas classes atuais.

Arquivos aplicados no HUD novo:

```text
icons/nec_grave_raise_dead.png
icons/nec_grave_harvest.png
icons/nec_grave_command_dead.png
icons/nec_grave_bone_ward.png
icons/nec_grave_legion_call.png
icons/nec_bone_spear.png
icons/nec_bone_corpse_burst.png
icons/nec_bone_blight_field.png
icons/nec_bone_soul_leech.png
icons/nec_bone_army_of_shadows.png
```

Grade usada no recorte atual:

- 8 colunas x 6 linhas
- largura do recorte: `91`
- altura do recorte: `92`
- passo horizontal: `112`
- passo vertical: `101`

No cliente Svelte, a vinculacao atual acontece em `client/src/svelte-hud/lib/proceduralSkillIcons.ts`.
