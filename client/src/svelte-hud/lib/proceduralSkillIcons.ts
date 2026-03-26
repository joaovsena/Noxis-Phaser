function svgDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function frame(primary: string, secondary: string) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1b1713"/>
        <stop offset="100%" stop-color="#0a0a0b"/>
      </linearGradient>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${secondary}"/>
        <stop offset="100%" stop-color="${primary}"/>
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="58" height="58" rx="10" fill="url(#bg)" stroke="url(#rim)" stroke-width="3"/>
    <rect x="9" y="9" width="46" height="46" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  `;
}

function glyphForSkill(skillId: string, color: string, alt: string) {
  const id = String(skillId || '').toLowerCase();
  if (id.includes('shield') || id.includes('bastion') || id.includes('muralha') || id.includes('juramento')) return `<path d="M32 16 L44 21 V31 C44 39 39 44 32 48 C25 44 20 39 20 31 V21 Z" fill="${alt}" stroke="${color}" stroke-width="2.5"/>`;
  if (id.includes('sword') || id.includes('ceif') || id.includes('lacer') || id.includes('quebra') || id.includes('chain')) return `<path d="M32 14 L39 21 L33 27 L36 30 L31 35 L25 29 L16 38 L13 35 L22 26 L17 21 Z" fill="${alt}" stroke="${color}" stroke-width="2"/><rect x="28" y="36" width="7" height="9" rx="2" fill="${color}"/>`;
  if (id.includes('arrow') || id.includes('tiro') || id.includes('flecha') || id.includes('shot') || id.includes('archer')) return `<line x1="18" y1="44" x2="45" y2="20" stroke="${alt}" stroke-width="4" stroke-linecap="round"/><polygon points="46,19 37,20 41,28" fill="${color}"/><path d="M20 20 C29 26,29 38,20 44" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  if (id.includes('wind') || id.includes('passo')) return `<path d="M17 32 C22 21,36 21,42 32 C35 43,23 43,17 32 Z" fill="${alt}" stroke="${color}" stroke-width="2.5"/><path d="M20 36 C27 31,35 31,42 36" fill="none" stroke="${color}" stroke-width="2"/>`;
  if (id.includes('bloom') || id.includes('flores') || id.includes('grove') || id.includes('sanctuary')) return `<circle cx="32" cy="32" r="7" fill="${color}"/><path d="M32 18 C36 24,36 28,32 30 C28 28,28 24,32 18 Z M46 32 C40 36,36 36,34 32 C36 28,40 28,46 32 Z M32 46 C28 40,28 36,32 34 C36 36,36 40,32 46 Z M18 32 C24 28,28 28,30 32 C28 36,24 36,18 32 Z" fill="${alt}" stroke="${color}" stroke-width="1.4"/>`;
  if (id.includes('roots') || id.includes('enxame') || id.includes('mire') || id.includes('druid') || id.includes('thorn')) return `<path d="M22 44 C21 35,26 27,32 20 C38 27,43 35,42 44" fill="${alt}" stroke="${color}" stroke-width="2.5"/><path d="M25 40 C27 33,30 29,32 24 C34 29,37 33,39 40" fill="none" stroke="${color}" stroke-width="2"/>`;
  if (id.includes('stealth') || id.includes('veil') || id.includes('smoke')) return `<path d="M18 34 C24 24,40 24,46 34 C40 42,24 42,18 34 Z" fill="${alt}" stroke="${color}" stroke-width="2.5"/><circle cx="32" cy="34" r="4.5" fill="${color}"/>`;
  if (id.includes('assassin') || id.includes('ambush') || id.includes('nightfall') || id.includes('blade') || id.includes('lunge')) return `<path d="M20 42 L31 18 L44 42 L32 48 Z" fill="${alt}" stroke="${color}" stroke-width="2.5"/><line x1="32" y1="20" x2="32" y2="47" stroke="${color}" stroke-width="2"/>`;
  if (id.includes('nec') || id.includes('bone') || id.includes('grave') || id.includes('soul') || id.includes('shadow') || id.includes('blight')) return `<circle cx="32" cy="19" r="7" fill="${alt}" stroke="${color}" stroke-width="2.2"/><path d="M22 45 C22 35,26 28,32 28 C38 28,42 35,42 45" fill="${alt}" stroke="${color}" stroke-width="2.5"/><path d="M26 21 L29 18 M35 18 L38 21 M28 38 L36 38" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  return `<circle cx="32" cy="32" r="12" fill="${alt}" stroke="${color}" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="${color}"/>`;
}

const CLASS_COLORS: Record<string, { primary: string; secondary: string }> = {
  knight: { primary: '#d4a867', secondary: '#f5e1b0' },
  archer: { primary: '#88cf6e', secondary: '#d8f2ae' },
  druid: { primary: '#62d0bf', secondary: '#d0fff1' },
  assassin: { primary: '#c977ae', secondary: '#f3c9ef' },
  necromancer: { primary: '#8d79e9', secondary: '#e5dcff' }
};

export function getSkillIconUrl(skillId: string, classId: string) {
  const colors = CLASS_COLORS[String(classId || '').toLowerCase()] || CLASS_COLORS.knight;
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      ${frame(colors.primary, colors.secondary)}
      ${glyphForSkill(skillId, colors.primary, colors.secondary)}
    </svg>
  `);
}
