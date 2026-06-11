import type { GameConfig } from "../lib/game-config";
import { loadPoolState, playersFromPool } from "../lib/pool-store";
import type { ResolvedPlayer, ResolvedGame } from "../utils/engine";
import { resolveGameState } from "../utils/engine";
import { formatScheduleTime } from "../utils/schedule";
import type { Team } from "../data/game";

function getConfig(): GameConfig | null {
  const el = document.getElementById("lms-config");
  if (!el?.textContent) return null;
  return JSON.parse(el.textContent) as GameConfig;
}

function teamById(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

function renderFighterCard(player: ResolvedPlayer, teams: Team[], currentRound: number, showPick: boolean): string {
  const pick = player.picks.find((p) => p.round === currentRound);
  const pickTeam = pick ? teamById(teams, pick.teamId) : undefined;
  const hasName = player.name !== "—";

  const pickHtml =
    showPick && pickTeam
      ? `<div class="fighter-card__pick">
          <span class="fighter-card__pick-label">Pick</span>
          <span class="fighter-card__team" style="--team-color: ${pickTeam.color}">${pickTeam.short}</span>
          ${
            pick && pick.won !== null && !player.eliminated
              ? `<span class="fighter-card__result ${pick.won ? "status-alive" : "status-dead"}">${pick.won ? "WIN" : "LOSS"}</span>`
              : pick && !player.eliminated
                ? `<span class="fighter-card__result" style="color: var(--text-muted)">PENDING</span>`
                : ""
          }
        </div>`
      : !hasName
        ? `<p class="fighter-card__round-dead">Not entered yet</p>`
        : "";

  return `<article class="fighter-card mk-panel ${player.eliminated ? "fighter-card--dead" : ""} ${!hasName ? "fighter-card--empty" : ""}">
    ${player.eliminated ? '<div class="fighter-card__fatality">FATALITY</div>' : ""}
    <div class="fighter-card__header">
      <span class="fighter-card__alias">${player.alias}</span>
      <span class="fighter-card__status ${player.eliminated ? "status-dead" : hasName ? "status-alive" : ""}" style="${!hasName ? "color: var(--text-muted)" : ""}">${player.eliminated ? "ELIMINATED" : hasName ? "ALIVE" : "OPEN"}</span>
    </div>
    <h3 class="fighter-card__name">${player.name}</h3>
    ${pickHtml}
    ${player.eliminated && player.eliminatedRound ? `<p class="fighter-card__round-dead">Fell in Round ${player.eliminatedRound}</p>` : ""}
    <div class="fighter-card__health">
      <div class="fighter-card__health-bar" style="width: ${player.eliminated || !hasName ? "0" : "100"}%"></div>
    </div>
  </article>`;
}

function applyResolvedState(resolved: ResolvedGame, config: GameConfig) {
  const alive = resolved.players.filter((p) => !p.eliminated && p.name !== "—");
  const eliminated = resolved.players.filter((p) => p.eliminated);

  document.querySelectorAll("[data-lms-round]").forEach((el) => {
    el.textContent = String(resolved.currentRound);
  });

  document.querySelectorAll("[data-lms-phase]").forEach((el) => {
    el.textContent = resolved.phaseLabel;
    el.classList.toggle("status-alive", resolved.picksOpen);
    el.classList.toggle("status-dead", resolved.phase === "locked" || resolved.phase === "in-play");
    el.classList.toggle("mk-gold-text", resolved.phase === "scoring");
  });

  document.querySelectorAll("[data-lms-alive]").forEach((el) => {
    el.textContent = String(alive.length);
  });

  document.querySelectorAll("[data-lms-eliminated]").forEach((el) => {
    el.textContent = String(eliminated.length);
  });

  document.querySelectorAll("[data-cutoff-status]").forEach((el) => {
    if (resolved.picksOpen) {
      el.textContent = "Picks open";
      el.classList.add("round-cutoff__status--open");
      el.classList.remove("round-cutoff__status--closed");
    } else if (resolved.phase === "scoring") {
      el.textContent = "Calculating…";
      el.classList.remove("round-cutoff__status--open", "round-cutoff__status--closed");
    } else if (resolved.phase === "tournament-over") {
      el.textContent = "Tournament over";
      el.classList.add("round-cutoff__status--closed");
    } else {
      el.textContent = "Picks closed";
      el.classList.add("round-cutoff__status--closed");
      el.classList.remove("round-cutoff__status--open");
    }
  });

  document.querySelectorAll(".round-cutoff").forEach((el) => {
    el.classList.toggle("round-cutoff--closed", !resolved.picksOpen);
  });

  const opensEl = document.querySelector("[data-lms-opens-at]");
  if (opensEl && resolved.schedule) {
    if (resolved.phase === "upcoming" && resolved.schedule.opensAt) {
      opensEl.textContent = `Opens ${formatScheduleTime(resolved.schedule.opensAt)}`;
      (opensEl as HTMLElement).style.display = "";
    } else {
      (opensEl as HTMLElement).style.display = "none";
    }
  }

  const winnerEl = document.getElementById("lms-winner");
  if (winnerEl) {
    if (resolved.winner) {
      winnerEl.innerHTML = `<div class="final-warning mk-panel"><p class="final-warning__text">🏆 ${resolved.winner.alias} WINS 🏆</p><p class="final-warning__sub">${resolved.winner.name} is the last fighter standing.</p></div>`;
      winnerEl.style.display = "";
    } else {
      winnerEl.style.display = "none";
    }
  }

  const survivors = document.getElementById("lms-survivors");
  if (survivors) {
    survivors.innerHTML = alive
      .map((player, i) =>
        `<div class="animate-slide-up" style="animation-delay: ${i * 0.1}s">${renderFighterCard(player, config.teams, resolved.currentRound, true)}</div>`,
      )
      .join("");
  }

  const fallen = document.getElementById("lms-fallen");
  if (fallen) {
    fallen.innerHTML = eliminated
      .sort((a, b) => (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0))
      .map((player) => renderFighterCard(player, config.teams, resolved.currentRound, false))
      .join("");
  }

  document.querySelectorAll(".timeline__round").forEach((el) => {
    const round = Number((el as HTMLElement).dataset.round);
    el.classList.toggle("timeline__round--current", round === resolved.currentRound);
    el.classList.toggle("timeline__round--past", round < resolved.currentRound);
  });
}

export async function tickGameState() {
  const config = getConfig();
  if (!config) return;

  const { state } = await loadPoolState();
  const players = playersFromPool(state);
  const resolved = resolveGameState(
    players,
    config.matches,
    config.totalRounds,
    Date.now(),
  );
  applyResolvedState(resolved, config);
}

tickGameState();
setInterval(tickGameState, 30_000);
