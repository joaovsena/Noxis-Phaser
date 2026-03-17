<script lang="ts">
  export let value = 0;
  export let max = 100;
  export let label = '';
  export let tone: 'health' | 'mana' | 'xp' = 'health';

  $: ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
</script>

<div class="bar-shell">
  <div class={`bar-fill tone-${tone}`} style={`transform: scaleX(${ratio});`}></div>
  <div class="bar-gloss"></div>
  <span>{label || `${value}/${max}`}</span>
</div>

<style>
  .bar-shell {
    position: relative;
    height: 18px;
    overflow: hidden;
    clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px);
    border: 1px solid rgba(201, 168, 106, 0.28);
    background:
      radial-gradient(circle at top, rgba(255, 229, 178, 0.05), transparent 42%),
      linear-gradient(180deg, rgba(10, 9, 8, 0.92), rgba(5, 6, 7, 0.98));
    box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.42);
  }

  .bar-fill,
  .bar-gloss {
    position: absolute;
    inset: 0;
    transform-origin: left center;
  }

  .tone-health {
    background: linear-gradient(90deg, #4e110d, #a52b22 48%, #d78b4b);
  }

  .tone-mana {
    background: linear-gradient(90deg, #14295f, #2c59b8 48%, #72aef7);
  }

  .tone-xp {
    background: linear-gradient(90deg, #6b4a0b, #b48524 48%, #e0c06c);
  }

  .bar-gloss {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 42%);
    pointer-events: none;
  }

  span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 0.68rem;
    color: #f9f1dc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
</style>
