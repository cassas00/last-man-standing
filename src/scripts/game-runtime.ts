import type { GameConfig } from "../lib/game-config";
import { applyResults } from "../lib/apply-results";
import { loadPoolState, playersFromPool } from "../lib/pool-store";
import { applyPrizeToDom, loadPoolSettings } from "../lib/pool-settings-store";
import { loadResults } from "../lib/results-store";
import type { ResolvedPlayer, ResolvedGame } from "../utils/engine";
import {
  getRoundPhase,
  getTeamsPlayingInRound,
  phaseLabel,
  resolveGameState,
} from "../utils/engine";
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

function renderPickCell(
  pick: ResolvedPlayer["picks"][number] | undefined,
  revealed: boolean,
  evaluated: boolean,
  teams: Team[],
): string {
  if (pick && !revealed) {
    return `<span class="pick-badge pick-badge--hidden" title="Hidden until deadline">?</span>`;
  }

  const team = pick && revealed ? teamById(teams, pick.teamId) : undefined;
  if (!team) {
    return `<span class="pick-empty">—</span>`;
  }

  const classes = ["pick-badge"];
  if (evaluated && pick?.won) classes.push("pick-badge--win");
  if (evaluated && pick && !pick.won) classes.push("pick-badge--loss");
  if (!evaluated) classes.push("pick-badge--pending");

  const title = !evaluated ? "Pending" : pick?.won ? "Win" : "Loss";

  return `<span class="${classes.join(" ")}" style="--team-color: ${team.color}" title="${title}">${team.short}</span>`;
}

function applyPicksPage(
  resolved: ResolvedGame,
  config: GameConfig,
  matches: RoundMatch[],
) {
  const tbody = document.getElementById("lms-picks-tbody");
  const teamsGrid = document.getElementById("lms-teams-grid");
  if (!tbody && !teamsGrid) return;

  const registered = resolved.players
    .filter((p) => p.name !== "—")
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  const currentRoundPicksRevealed = areRoundPicksRevealed(resolved.currentRound, matches);
  const alive = resolved.players.filter((p) => !p.eliminated && p.name !== "—");

  const subEl = document.querySelector("[data-lms-picks-sub]");
  if (subEl) {
    subEl.textContent = currentRoundPicksRevealed
      ? `Round ${resolved.currentRound} picks are revealed. ${resolved.phaseLabel}.`
      : `Picks stay hidden until the deadline. ${resolved.phaseLabel}.`;
  }

  if (tbody) {
    if (registered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${config.totalRounds + 2}" class="picks-loading">No players registered yet.</td></tr>`;
    } else {
      tbody.innerHTML = registered
        .map((player) => {
          const roundCells = Array.from({ length: config.totalRounds }, (_, i) => {
            const round = i + 1;
            const pick = player.picks.find((p) => p.round === round);
            const revealed = areRoundPicksRevealed(round, matches);
            const evaluated = resolved.evaluatedRound >= round;
            return `<td class="pick-cell">${renderPickCell(pick, revealed, evaluated, config.teams)}</td>`;
          }).join("");

          return `<tr class="${player.eliminated ? "row--dead" : ""}">
            <td class="fighter-cell"><span class="fighter-cell__name">${player.name}</span></td>
            ${roundCells}
            <td><span class="status-badge ${player.eliminated ? "status-dead" : "status-alive"}">${player.eliminated ? `R${player.eliminatedRound}` : "ALIVE"}</span></td>
          </tr>`;
        })
        .join("");
    }
  }

  if (teamsGrid) {
    const teamsInRound = getTeamsPlayingInRound(
      resolved.currentRound,
      matches,
      config.teams,
    );

    teamsGrid.innerHTML = teamsInRound
      .map((team) => {
        const pickedBy = currentRoundPicksRevealed
          ? alive.filter((p) => {
              const pick = p.picks.find((pk) => pk.round === resolved.currentRound);
              return pick?.teamId === team.id;
            })
          : [];

        const pickedLabel = !currentRoundPicksRevealed
          ? "Picks hidden until deadline"
          : pickedBy.length > 0
            ? `Picked by: ${pickedBy.map((p) => p.name).join(", ")}`
            : "No picks yet";

        return `<div class="team-card mk-panel" style="--team-color: ${team.color}">
          <span class="team-card__short">${team.short}</span>
          <span class="team-card__name">${team.name}</span>
          <span class="team-card__picked">${pickedLabel}</span>
        </div>`;
      })
      .join("");
  }
}

function applyResolvedState(resolved: ResolvedGame, config: GameConfig, matches: RoundMatch[]) {
  const alive = resolved.players.filter((p) => !p.eliminated && p.name !== "—");
  const eliminated = resolved.players.filter((p) => p.eliminated);

  const enterCta = document.getElementById("lms-enter-cta");
  if (enterCta) {
    enterCta.hidden = !resolved.picksOpen;
    const textEl = enterCta.querySelector("[data-lms-enter-cta-text]");
    if (textEl) {
      textEl.textContent = `Round ${resolved.currentRound} picks are open — submit your team before the deadline.`;
    }
  }

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
    const isCurrent = round === resolved.currentRound;
    const isPast = round < resolved.currentRound;

    el.classList.toggle("timeline__round--current", isCurrent);
    el.classList.toggle("timeline__round--past", isPast);

    const liveEl = el.querySelector("[data-lms-timeline-live]");
    if (liveEl) {
      (liveEl as HTMLElement).hidden = !isCurrent;
    }

    const phaseEl = el.querySelector("[data-lms-timeline-phase]");
    if (phaseEl) {
      phaseEl.textContent = phaseLabel(
        getRoundPhase(round, matches, config.totalRounds, Date.now()),
      );
    }
  });

  const matchList = document.querySelector(".match-list");
  if (matchList) {
    const roundMatches = matches.filter((m) => m.round === resolved.currentRound);
    matchList.innerHTML = roundMatches.map((match) => renderMatchCard(match)).join("");
  }

  applyPicksPage(resolved, config, matches);
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
