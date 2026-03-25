import type { PetMoveStyle, PetRole } from '../models/types';

export type PetTemplate = {
    id: string;
    name: string;
    biomeKey: string;
    role: PetRole;
    moveStyle: PetMoveStyle;
    baseHp: number;
    baseDamage: number;
    cadenceMs: number;
    supportPower: number;
    leashRange: number;
    orbitX: number;
    orbitY: number;
    tintPrimary: number;
    tintSecondary: number;
};

export const PET_TEMPLATES: Record<string, PetTemplate> = {
    city_dog: {
        id: 'city_dog',
        name: 'Cão',
        biomeKey: 'city',
        role: 'offensive',
        moveStyle: 'ground',
        baseHp: 140,
        baseDamage: 16,
        cadenceMs: 1800,
        supportPower: 0,
        leashRange: 280,
        orbitX: -74,
        orbitY: 34,
        tintPrimary: 0x9e6b45,
        tintSecondary: 0xf0d0a7
    },
    forest_macaw: {
        id: 'forest_macaw',
        name: 'Arara',
        biomeKey: 'forest',
        role: 'support',
        moveStyle: 'flying',
        baseHp: 110,
        baseDamage: 0,
        cadenceMs: 3200,
        supportPower: 18,
        leashRange: 340,
        orbitX: 62,
        orbitY: -56,
        tintPrimary: 0x3aa4ff,
        tintSecondary: 0xffd54a
    },
    lava_golem: {
        id: 'lava_golem',
        name: 'Golem de Lava',
        biomeKey: 'lava',
        role: 'defensive',
        moveStyle: 'heavy',
        baseHp: 220,
        baseDamage: 10,
        cadenceMs: 2600,
        supportPower: 22,
        leashRange: 220,
        orbitX: -88,
        orbitY: 40,
        tintPrimary: 0xc7512e,
        tintSecondary: 0xffb347
    },
    undead_skeleton_archer: {
        id: 'undead_skeleton_archer',
        name: 'Arqueiro esqueleto',
        biomeKey: 'undead',
        role: 'offensive',
        moveStyle: 'ranged',
        baseHp: 124,
        baseDamage: 18,
        cadenceMs: 1600,
        supportPower: 0,
        leashRange: 420,
        orbitX: 90,
        orbitY: 24,
        tintPrimary: 0xd8d2bf,
        tintSecondary: 0x7d5f44
    }
};

export const STARTER_PET_TEMPLATE_IDS = Object.keys(PET_TEMPLATES);

export function getPetTemplate(templateId: string) {
    return PET_TEMPLATES[String(templateId || '')] || null;
}
