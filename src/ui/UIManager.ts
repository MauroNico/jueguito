import type { RunStats, TimeMode, UpgradeCategory } from '../core/Types';
import { getUpgradeById } from '../config/UpgradeConfig';
import type { Entity } from '../core/Entity';
import { HealthComponent } from '../components/HealthComponent';
import { CombatComponent } from '../components/CombatComponent';
import { PlayerControlComponent } from '../components/PlayerControlComponent';
import { UpgradeComponent } from '../components/UpgradeComponent';
import { AIComponent } from '../components/AIComponent';

const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  military: 'FACCIÓN MILITAR',
  thunder: 'DIOS DEL RAYO',
  solar: 'FACCIÓN SOLAR'
};

const STATE_LABELS: Record<string, string> = {
  idle: 'LISTO',
  moving: 'EN MOVIMIENTO',
  basic_attack: 'BARRIDA MARTILLO',
  charging_heavy: 'CANALIZANDO (2s)',
  heavy_dash: 'EMBISTE INVULNERABLE',
  charging_skill_q: 'PREPARANDO SALTO Q',
  skill_q_slam: 'GOLPE SÍSMICO',
  dashing_space: 'DESPLAZAMIENTO',
  ultimate_spinning: 'CICLÓN DEFINITIVO (5s)'
};

export class UIManager {
  private hudTop = document.getElementById('hud-top')!;
  private hudBottom = document.getElementById('hud-bottom')!;
  private bossHud = document.getElementById('boss-hud')!;
  private bossHpFill = document.getElementById('boss-hp-fill')!;
  private chargeHud = document.getElementById('charge-hud')!;
  private chargeLabel = document.getElementById('charge-label')!;
  private chargeFill = document.getElementById('charge-fill')!;

  private playerHpFill = document.getElementById('player-hp-fill')!;
  private playerHpText = document.getElementById('player-hp-text')!;
  private playerStateChip = document.getElementById('player-state-chip')!;
  private roomLabel = document.getElementById('room-label')!;
  private roomStatus = document.getElementById('room-status')!;
  private enemiesCount = document.getElementById('enemies-count')!;
  private comboDisplay = document.getElementById('combo-display')!;
  private comboCount = document.getElementById('combo-count')!;
  private upgradesList = document.getElementById('upgrades-list')!;
  private timeModeLabel = document.getElementById('time-mode-label')!;
  private toggleTimeBtn = document.getElementById('toggle-time-btn')!;

  private cdBasic = document.getElementById('cd-basic')!;
  private cdHeavy = document.getElementById('cd-heavy')!;
  private cdQ = document.getElementById('cd-q')!;
  private cdDash = document.getElementById('cd-dash')!;
  private cdUlt = document.getElementById('cd-ult')!;

  private startDialog = document.getElementById('start-dialog') as HTMLDialogElement;
  private startRunBtn = document.getElementById('start-run-btn')!;
  private upgradeDialog = document.getElementById('upgrade-dialog') as HTMLDialogElement;
  private upgradeContainer = document.getElementById('upgrade-cards-container')!;
  private endDialog = document.getElementById('end-dialog') as HTMLDialogElement;
  private endEyebrow = document.getElementById('end-eyebrow')!;
  private endTitle = document.getElementById('end-dialog-title')!;
  private endSummary = document.getElementById('end-summary')!;
  private endStats = document.getElementById('end-stats')!;
  private restartRunBtn = document.getElementById('restart-run-btn')!;

  public selectedTimeMode: TimeMode = 'night';

  constructor(callbacks: {
    onStartRun: (mode: TimeMode) => void;
    onSelectUpgrade: (upgradeId: string) => void;
    onToggleTimeMode: () => void;
  }) {
    // Time mode choice buttons on start modal
    const timeChoices = this.startDialog.querySelectorAll<HTMLButtonElement>('.time-choice');
    timeChoices.forEach((btn) => {
      btn.addEventListener('click', () => {
        timeChoices.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTimeMode = (btn.dataset.time as TimeMode) ?? 'night';
        this.updateTimeModeLabel(this.selectedTimeMode);
      });
    });

    this.startRunBtn.addEventListener('click', () => {
      this.startDialog.close();
      this.hudTop.classList.remove('hidden');
      this.hudBottom.classList.remove('hidden');
      callbacks.onStartRun(this.selectedTimeMode);
    });

    this.restartRunBtn.addEventListener('click', () => {
      this.endDialog.close();
      this.hudTop.classList.remove('hidden');
      this.hudBottom.classList.remove('hidden');
      callbacks.onStartRun(this.selectedTimeMode);
    });

    this.toggleTimeBtn.addEventListener('click', () => {
      callbacks.onToggleTimeMode();
    });

    this.upgradeContainer.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLButtonElement>('.upgrade-card');
      if (!card || !card.dataset.upgradeId) return;
      const id = card.dataset.upgradeId;
      this.upgradeDialog.close();
      callbacks.onSelectUpgrade(id);
    });
  }

  public showStartModal(): void {
    this.hudTop.classList.add('hidden');
    this.hudBottom.classList.add('hidden');
    this.bossHud.classList.add('hidden');
    this.chargeHud.classList.add('hidden');
    if (!this.startDialog.open) {
      this.startDialog.showModal();
    }
  }

  public showUpgradeModal(optionIds: string[]): void {
    this.upgradeContainer.innerHTML = '';
    optionIds.forEach((id, idx) => {
      const def = getUpgradeById(id);
      if (!def) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `upgrade-card ${def.category}`;
      btn.dataset.upgradeId = def.id;
      if (idx === 0) btn.autofocus = true;

      btn.innerHTML = `
        <span class="upgrade-badge">${CATEGORY_LABELS[def.category]}</span>
        <h3>${def.name}</h3>
        <p>${def.description}</p>
      `;
      this.upgradeContainer.appendChild(btn);
    });

    if (!this.upgradeDialog.open) {
      this.upgradeDialog.showModal();
    }
  }

  public showEndModal(victory: boolean, stats: RunStats): void {
    this.bossHud.classList.add('hidden');
    this.chargeHud.classList.add('hidden');
    this.endEyebrow.textContent = victory ? 'VICTORIA URBANA // CALLE DESPEJADA' : 'DERROTA // FIN DE LA RUN';
    this.endTitle.textContent = victory ? '¡GENERAL DERROTADO!' : 'BARRY HA CAÍDO';
    this.endSummary.textContent = victory
      ? 'Has sobrevivido a las 10 habitaciones y derrotado al General Corrupto.'
      : 'Las hordas infectadas te superaron en la calle. ¡Vuelve a intentarlo!';

    this.endStats.innerHTML = `
      <div>Habitaciones superadas: <strong>${stats.roomsCleared} / 10</strong></div>
      <div>Enemigos derrotados: <strong>${stats.enemiesDefeated}</strong></div>
      <div>Daño total infligido: <strong>${stats.damageDealt}</strong></div>
      <div>Mejoras obtenidas: <strong>${stats.upgradesPicked}</strong></div>
    `;

    if (!this.endDialog.open) {
      this.endDialog.showModal();
    }
  }

  public updateTimeModeLabel(mode: TimeMode): void {
    this.timeModeLabel.textContent =
      mode === 'night' ? 'NOCHE' : mode === 'day' ? 'DÍA' : 'CICLO';
  }

  public updateHUD(
    player: Entity | undefined,
    enemies: Entity[],
    roomNumber: number,
    enemiesRemaining: number,
    roomPhase: string
  ): void {
    this.roomLabel.textContent = `HABITACIÓN ${Math.min(10, roomNumber)} / 10`;
    this.enemiesCount.textContent = String(enemiesRemaining);
    this.roomStatus.textContent =
      roomPhase === 'combat'
        ? 'EN COMBATE'
        : roomPhase === 'awaiting_upgrade'
          ? 'ZONA DESPEJADA'
          : 'AVANZA AL SIGUIENTE SECTOR';

    if (!player) return;

    const health = player.getComponent<HealthComponent>('Health');
    const ctrl = player.getComponent<PlayerControlComponent>('PlayerControl');
    const combat = player.getComponent<CombatComponent>('Combat');
    const upgrade = player.getComponent<UpgradeComponent>('Upgrade');

    if (health) {
      const pct = Math.max(0, Math.min(100, (health.hp / health.maxHp) * 100));
      this.playerHpFill.style.width = `${pct}%`;
      this.playerHpText.textContent = `${Math.ceil(health.hp)} / ${health.maxHp}`;
    }

    if (combat) {
      if (combat.totalComboHits >= 2) {
        this.comboDisplay.classList.remove('hidden');
        this.comboCount.textContent = String(combat.totalComboHits);
      } else {
        this.comboDisplay.classList.add('hidden');
      }
    }

    if (ctrl) {
      this.playerStateChip.textContent = STATE_LABELS[ctrl.state] ?? 'ACTIVO';

      this.setCooldownOverlay(this.cdBasic, ctrl.basicCooldown);
      this.setCooldownOverlay(this.cdHeavy, ctrl.heavyCooldown);
      this.setCooldownOverlay(this.cdQ, ctrl.skillQCooldown);
      this.setCooldownOverlay(this.cdDash, ctrl.dashCooldown);
      this.setCooldownOverlay(this.cdUlt, ctrl.ultCooldown);

      // Show charge bar for 2s Heavy channel or Q preparation charge or 5s Ult remaining
      if (ctrl.state === 'charging_heavy') {
        const pct = Math.min(100, (ctrl.heavyChannelTime / ctrl.heavyChannelRequired) * 100);
        this.chargeHud.classList.remove('hidden');
        this.chargeLabel.textContent = `CANALIZANDO EMBISTE (${ctrl.heavyChannelTime.toFixed(1)}s / 2.0s)`;
        this.chargeFill.style.width = `${pct}%`;
      } else if (ctrl.state === 'charging_skill_q') {
        const pct = Math.min(100, (ctrl.skillQChargeTime / ctrl.skillQChargeRequired) * 100);
        this.chargeHud.classList.remove('hidden');
        this.chargeLabel.textContent =
          pct >= 100 ? '¡SALTO Q CARGADO AL MÁXIMO (2x ÁREA)!' : 'CARGANDO SALTO Q...';
        this.chargeFill.style.width = `${pct}%`;
      } else if (ctrl.state === 'ultimate_spinning') {
        const pct = Math.max(0, (ctrl.stateTimer / 5.0) * 100);
        this.chargeHud.classList.remove('hidden');
        this.chargeLabel.textContent = `CICLÓN DEFINITIVO (${ctrl.stateTimer.toFixed(1)}s)`;
        this.chargeFill.style.width = `${pct}%`;
      } else {
        this.chargeHud.classList.add('hidden');
      }
    }

    if (upgrade) {
      this.upgradesList.innerHTML = '';
      for (const u of upgrade.acquired) {
        const chip = document.createElement('span');
        chip.className = `upgrade-chip ${u.category}`;
        chip.textContent = u.name;
        this.upgradesList.appendChild(chip);
      }
    }

    // Boss HP Bar
    const boss = enemies.find((e) => e.getComponent<AIComponent>('AI')?.enemyType === 'boss');
    if (boss) {
      const bh = boss.requireComponent<HealthComponent>('Health');
      this.bossHud.classList.remove('hidden');
      this.bossHpFill.style.width = `${Math.max(0, (bh.hp / bh.maxHp) * 100)}%`;
    } else {
      this.bossHud.classList.add('hidden');
    }
  }

  private setCooldownOverlay(el: HTMLElement, value: number): void {
    if (value > 0.05) {
      el.classList.add('active');
      el.textContent = value.toFixed(1);
    } else {
      el.classList.remove('active');
      el.textContent = '';
    }
  }
}
