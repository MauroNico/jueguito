import type { Component } from '../core/Component';
import type { AIState, EnemyType } from '../core/Types';

export class AIComponent implements Component {
  public readonly type = 'AI' as const;
  public enemyType: EnemyType;
  public state: AIState = 'chase';
  public stateTimer = 0;
  public attackCooldown = 0;

  public preferredRange: number;
  public attackDamage: number;
  public moveSpeed: number;

  // Telegraph / action vectors
  public actionDirX = 0;
  public actionDirZ = 0;
  public targetX = 0;
  public targetZ = 0;
  public burstRemaining = 0;
  public burstTimer = 0;
  public grenadeCooldown = 3.5;

  constructor(
    enemyType: EnemyType,
    preferredRange: number,
    attackDamage: number,
    moveSpeed: number
  ) {
    this.enemyType = enemyType;
    this.preferredRange = preferredRange;
    this.attackDamage = attackDamage;
    this.moveSpeed = moveSpeed;
  }
}
