import type { Component } from '../core/Component';
import type { CharacterId, EntityId, PlayerActionState } from '../core/Types';

export class PlayerControlComponent implements Component {
  public readonly type = 'PlayerControl' as const;
  public characterId: CharacterId;
  public state: PlayerActionState = 'idle';

  // Timers & cooldowns
  public stateTimer = 0;
  public basicCooldown = 0;
  public heavyCooldown = 0;
  public skillQCooldown = 0;
  public dashCooldown = 0;
  public ultCooldown = 0;

  // Channeling / Charge tracking
  public heavyChannelTime = 0;
  public readonly heavyChannelRequired = 2.0;
  public heavyDashDirX = 1;
  public heavyDashDirZ = 0;
  public heavyDashHitIds = new Set<EntityId>();

  public skillQChargeTime = 0;
  public readonly skillQChargeRequired = 0.85;
  public skillQIsCharged = false;
  public skillQHasLanded = false;
  public skillQOriginX = 0;
  public skillQOriginZ = 0;

  public basicHitFired = false;
  public basicDirX = 1;
  public basicDirZ = 0;

  public dashDirX = 1;
  public dashDirZ = 0;

  public ultSpinTickTimer = 0;
  public ultAngle = 0;

  constructor(characterId: CharacterId = 'barry') {
    this.characterId = characterId;
  }
}
