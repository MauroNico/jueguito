import type { EnemyType } from '../core/Types';

export interface RoomWaveSpec {
  roomNumber: number;
  streetEnemies: Array<{ type: EnemyType; count: number }>;
  windowEnemies: Array<{ type: EnemyType; count: number }>;
  isBossRoom?: boolean;
}

export const ROOM_CONFIGS: RoomWaveSpec[] = [
  // Habitación 1: solo zombies normales
  {
    roomNumber: 1,
    streetEnemies: [{ type: 'normal', count: 4 }],
    windowEnemies: []
  },
  // Habitación 2: se suman zombies disparadores
  {
    roomNumber: 2,
    streetEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 2 }
    ],
    windowEnemies: []
  },
  // Habitación 3: se suman zombies tanques
  {
    roomNumber: 3,
    streetEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 2 },
      { type: 'tank', count: 1 }
    ],
    windowEnemies: []
  },
  // Habitación 4: a partir de aquí salen enemigos por las ventanas
  {
    roomNumber: 4,
    streetEnemies: [
      { type: 'normal', count: 3 },
      { type: 'shooter', count: 2 },
      { type: 'tank', count: 1 }
    ],
    windowEnemies: [{ type: 'normal', count: 3 }]
  },
  // Habitación 5
  {
    roomNumber: 5,
    streetEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 3 },
      { type: 'tank', count: 1 }
    ],
    windowEnemies: [
      { type: 'normal', count: 3 },
      { type: 'shooter', count: 1 }
    ]
  },
  // Habitación 6
  {
    roomNumber: 6,
    streetEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 3 },
      { type: 'tank', count: 2 }
    ],
    windowEnemies: [
      { type: 'normal', count: 3 },
      { type: 'shooter', count: 2 }
    ]
  },
  // Habitación 7
  {
    roomNumber: 7,
    streetEnemies: [
      { type: 'normal', count: 5 },
      { type: 'shooter', count: 4 },
      { type: 'tank', count: 2 }
    ],
    windowEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 2 }
    ]
  },
  // Habitación 8
  {
    roomNumber: 8,
    streetEnemies: [
      { type: 'normal', count: 5 },
      { type: 'shooter', count: 4 },
      { type: 'tank', count: 3 }
    ],
    windowEnemies: [
      { type: 'normal', count: 4 },
      { type: 'shooter', count: 3 }
    ]
  },
  // Habitación 9
  {
    roomNumber: 9,
    streetEnemies: [
      { type: 'normal', count: 6 },
      { type: 'shooter', count: 5 },
      { type: 'tank', count: 3 }
    ],
    windowEnemies: [
      { type: 'normal', count: 5 },
      { type: 'shooter', count: 3 },
      { type: 'tank', count: 1 }
    ]
  },
  // Habitación 10: Jefe Militar + escoltas
  {
    roomNumber: 10,
    isBossRoom: true,
    streetEnemies: [
      { type: 'boss', count: 1 },
      { type: 'normal', count: 3 },
      { type: 'shooter', count: 2 }
    ],
    windowEnemies: [{ type: 'normal', count: 3 }]
  }
];
