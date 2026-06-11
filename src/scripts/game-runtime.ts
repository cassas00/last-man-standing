import type { GameConfig } from "../lib/game-config";
import { applyResults } from "../lib/apply-results";
import { loadPoolState, playersFromPool } from "../lib/pool-store";
import { applyPrizeToDom, loadPoolSettings } from "../lib/pool-settings-store";
import { loadResults } from "../lib/results-store";
import type { ResolvedPlayer, ResolvedGame } from "../utils/engine";
import { resolveGameState } from "../utils/engine";
import { areRoundPicksRevealed, formatScheduleTime } from "../utils/schedule";
import type { RoundMatch, Team } from "../data/game";
import { getTeam } from "../data/game";

function getConfig(): GameConfig | null {
  const el = document.getElementById("lms-config");
  if (!el?.textContent) return null;
  return JSON.parse(el.textContent) as GameConfig;
}

function teamById(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

function renderFighterCard(
  player: ResolvedPlayer,
  teams: Team[],
  currentRound: number,
  showPick: boolean,
  revealPicks: boolean,
): string {
  const pick = player.picks.find((p) => p.round === currentRound);
  const pickTeam = pick && revealPicks ? teamById(teams, pick.teamId) : undefined;
  const pickHidden = !!(pick && !revealPicks);
  const hasName = player.name !== "—";

  const pickHtml =
    showPick && pickHidden
      ? `<p class="fighter-card__pick-hidden">Pick hidden until deadline</p>`
      : showPick && pickTeam
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
      <h3 class="fighter-card__name">${player.name}</h3>
      <span class="fighter-card__status ${player.eliminated ? "status-dead" : hasName ? "status-alive" : ""}" style="${!hasName ? "color: var(--text-muted)" : ""}">${player.eliminated ? "ELIMINATED" : hasName ? "ALIVE" : "OPEN"}</span>
    </div>
    ${pickHtml}
    ${player.eliminated && player.eliminatedRound ? `<p class="fighter-card__round-dead">Fell in Round ${player.eliminatedRound}</p>` : ""}
    <div class="fighter-card__health">
      <div class="fighter-card__health-bar" style="width: ${player.eliminated || !hasName ? "0" : "100"}%"></div>
    </div>
  </article>`;
}

function renderMatchCard(match: RoundMatch): string {
  const home = match.homeTeamId ? getTeam(match.homeTeamId) : undefined;
  const away = match.awayTeamId ? getTeam(match.awayTeamId) : undefined;
  const hasResult = !!match.winnerId || !!match.isDraw;
  const isDraw = !!match.isDraw;
  const homeWon = !!match.winnerId && !isDraw && match.winnerId === match.homeTeamId;
  const awayWon = !!match.winnerId && !isDraw && match.winnerId === match.awayTeamId;
  const homeShort = home?.short ?? match.homeLabel ?? "TBD";
  const awayShort = away?.short ?? match.awayLabel ?? "TBD";
  const homeName = home?.name ?? match.homeLabel ?? "TBD";
  const awayName = away?.name ?? match.awayLabel ?? "TBD";
  const homeColor = home?.color ?? "var(--text-muted)";
  const awayColor = away?.color ?? "var(--text-muted)";
  const kickoff = match.kickoffAt ? formatScheduleTime(match.kickoffAt) : "";

  return `<div class="match-card mk-panel ${hasResult ? "" : "match-card--pending"}">
    <p class="match-card__label">
      ${match.label}
      <span class="match-card__match-no">#${match.matchNumber}</span>
      ${kickoff ? `<span class="match-card__kickoff">${kickoff}</span>` : ""}
    </p>
    <div class="match-card__fighters">
      <div class="match-card__team ${homeWon ? "match-card__team--winner" : ""} ${!home ? "match-card__team--tbd" : ""}">
        <span class="match-card__short" style="--c: ${homeColor}">${homeShort}</span>
        <span class="match-card__name">${homeName}</span>
        ${homeWon ? '<span class="match-card__win">W</span>' : ""}
        ${isDraw && home ? '<span class="match-card__draw">D</span>' : ""}
      </div>
      <span class="match-card__vs">VS</span>
      <div class="match-card__team ${awayWon ? "match-card__team--winner" : ""} ${!away ? "match-card__team--tbd" : ""}">
        <span class="match-card__short" style="--c: ${awayColor}">${awayShort}</span>
        <span class="match-card__name">${awayName}</span>
        ${awayWon ? '<span class="match-card__win">W</span>' : ""}
        ${isDraw && away ? '<span class="match-card__draw">D</span>' : ""}
      </div>
    </div>
  </div>`;
}

function applyResolvedState(resolved: ResolvedGame, config: GameConfig, matches: RoundMatch[]) {
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
      winnerEl.innerHTML = `<div class="final-warning mk-panel"><p class="final-warning__text">🏆 ${resolved.winner.name} WINS 🏆</p><p class="final-warning__sub">Last fighter standing.</p></div>`;
      winnerEl.style.display = "";
    } else {
      winnerEl.style.display = "none";
    }
  }

  const picksRevealed = areRoundPicksRevealed(resolved.currentRound, matches);

  const survivors = document.getElementById("lms-survivors");
  if (survivors) {
    survivors.innerHTML = alive
      .map(
        (player, i) =>
          `<div class="animate-slide-up" style="animation-delay: ${i * 0.1}s">${renderFighterCard(player, config.teams, resolved.currentRound, true, picksRevealed)}</div>`,
      )
      .join("");
  }

  const fallen = document.getElementById("lms-fallen");
  if (fallen) {
    fallen.innerHTML = eliminated
      .sort((a, b) => (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0))
      .map((player) => renderFighterCard(player, config.teams, resolved.currentRound, false, false))
      .join("");
  }

  document.querySelectorAll(".timeline__round").forEach((el) => {
    const round = Number((el as HTMLElement).dataset.round);
    el.classList.toggle("timeline__round--current", round === resolved.currentRound);
    el.classList.toggle("timeline__round--past", round < resolved.currentRound);
  });

  const matchList = document.querySelector(".match-list");
  if (matchList) {
    const roundMatches = matches.filter((m) => m.round === resolved.currentRound);
    matchList.innerHTML = roundMatches.map((match) => renderMatchCard(match)).join("");
  }
}

export async function tickGameState() {
  const config = getConfig();
  if (!config) return;

  const [{ state }, results, settings] = await Promise.all([
    loadPoolState(),
    loadResults(),
    loadPoolSettings(),
  ]);
  const matches = applyResults(config.matches, results);
  const players = playersFromPool(state);
  const resolved = resolveGameState(players, matches, config.totalRounds, Date.now());
  applyResolvedState(resolved, config, matches);
  applyPrizeToDom(settings);
}

tickGameState();
setInterval(tickGameState, 30_000);
