import type { UpgradeCategory, UpgradeDefinition } from '../core/Types';

export const UPGRADE_POOL: UpgradeDefinition[] = [
  // Militar: aumentan rango y daño
  {
    id: 'mil_calibre_pesado',
    name: 'Calibre Pesado',
    category: 'military',
    tier: 1,
    description: '+25% de Daño y +20% de Rango en todos los ataques y habilidades.',
    damageMultiplierBonus: 0.25,
    rangeMultiplierBonus: 0.2
  },
  {
    id: 'mil_aleacion_tactica',
    name: 'Aleación Táctica',
    category: 'military',
    tier: 2,
    description: '+32% de Daño y +25% de Rango de impacto con el martillo.',
    damageMultiplierBonus: 0.32,
    rangeMultiplierBonus: 0.25
  },
  {
    id: 'mil_protocolo_asalto',
    name: 'Protocolo de Asalto',
    category: 'military',
    tier: 3,
    description: '+40% de Daño bruto y +30% de Rango extendido de combate.',
    damageMultiplierBonus: 0.4,
    rangeMultiplierBonus: 0.3
  },

  // Dios del Rayo: aplican aturdido por fracciones de segundo
  {
    id: 'rayo_chispa_divina',
    name: 'Chispa de Zeus',
    category: 'thunder',
    tier: 1,
    description: 'Tus ataques y habilidades aturden a los enemigos durante 0.35s.',
    thunderStunDuration: 0.35
  },
  {
    id: 'rayo_descarga_arco',
    name: 'Arco Voltáico',
    category: 'thunder',
    tier: 2,
    description: 'Sobrecarga eléctrica que suma +0.45s de aturdimiento en cada golpe.',
    thunderStunDuration: 0.45
  },
  {
    id: 'rayo_juicio_celeste',
    name: 'Juicio del Trueno',
    category: 'thunder',
    tier: 3,
    description: 'Tormenta mítica que añade +0.60s de aturdimiento al impactar.',
    thunderStunDuration: 0.6
  },

  // Solar: daño adicional al impacto tras retraso de 1 segundo
  {
    id: 'solar_brasa_latente',
    name: 'Brasa Latente',
    category: 'solar',
    tier: 1,
    description: 'Los impactos marcan al enemigo y detonan +35% de daño solar tras 1s de retraso.',
    solarDelayedRatio: 0.35,
    solarBlastRadius: 1.6
  },
  {
    id: 'solar_llama_cenit',
    name: 'Llama del Cenit',
    category: 'solar',
    tier: 2,
    description: 'Suma +45% de daño solar adicional que explota exactamente 1s después del golpe.',
    solarDelayedRatio: 0.45,
    solarBlastRadius: 2.0
  },
  {
    id: 'solar_corona_apolo',
    name: 'Corona de Apolo',
    category: 'solar',
    tier: 3,
    description: 'Marca solar suprema: +60% de daño adicional tras 1s de retraso en área ampliada.',
    solarDelayedRatio: 0.6,
    solarBlastRadius: 2.4
  }
];

export function rollUpgradeChoices(count = 3): UpgradeDefinition[] {
  const categories: UpgradeCategory[] = ['military', 'thunder', 'solar'];
  const picks: UpgradeDefinition[] = [];

  for (const cat of categories) {
    const candidates = UPGRADE_POOL.filter((u) => u.category === cat);
    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      picks.push(candidates[idx]);
    }
  }

  return picks.slice(0, count);
}

export function getUpgradeById(id: string): UpgradeDefinition | undefined {
  return UPGRADE_POOL.find((u) => u.id === id);
}
