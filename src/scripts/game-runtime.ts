import type { GameConfig } from "../lib/game-config";
import { applyResults } from "../lib/apply-results";
import { loadPoolState, playersFromPool } from "../lib/pool-store";
import { applyPrizeToDom, loadPoolSettings } from "../lib/pool-settings-store";
import { scheduleOptionsFromSettings } from "../lib/schedule-options";
import { loadResults } from "../lib/results-store";
import type { ResolvedPlayer, ResolvedGame } from "../utils/engine";
import {
  getRoundPhase,
  getTeamsPlayingInRound,
  getFinalTwo,
  phaseLabel,
  resolveGameState,
} from "../utils/engine";
import {
  areRoundPicksRevealed,
  formatScheduleTime,
  getRoundSchedule,
  type ScheduleOptions,
} from "../utils/schedule";
import type { RoundMatch, Team } from "../data/game";
import { getTeam } from "../data/game";
import { getRoundInfo } from "../data/rounds";

let activeScheduleOptions: ScheduleOptions = {};

function getConfig(): GameConfig | null {
  const el = document.getElementById("lms-config");
  if (!el?.textContent) return null;
  return JSON.parse(el.textContent) as GameConfig;
}

function teamById(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function renderFinalDuel(
  playerA: ResolvedPlayer,
  playerB: ResolvedPlayer,
  teams: Team[],
  currentRound: number,
  revealPicks: boolean,
  roundLabel?: string,
): string {
  function fighterSide(player: ResolvedPlayer, side: "left" | "right") {
    const pick = player.picks.find((p) => p.round === currentRound);
    const team = pick && revealPicks ? teamById(teams, pick.teamId) : undefined;
    const pickHidden = !!(pick && !revealPicks);
    const accent = team?.color ?? "var(--red-fire)";

    let status = "";
    let statusClass = "";
    if (pick && revealPicks && pick.won === true) {
      status = "WIN";
      statusClass = "status-alive";
    } else if (pick && revealPicks && pick.won === false) {
      status = "LOSS";
      statusClass = "status-dead";
    } else if (pick && revealPicks) {
      status = "PENDING";
      statusClass = "final-duel__status--pending";
    }

    const pickHtml = pickHidden
      ? `<span class="final-duel__pick final-duel__pick--hidden">PICKED</span>`
      : team
        ? `<span class="final-duel__pick" style="--team-color: ${team.color}">${team.short}</span>`
        : `<span class="final-duel__pick final-duel__pick--none">No pick</span>`;

    return `<div class="final-duel__fighter final-duel__fighter--${side}" style="--accent: ${accent}">
      <div class="final-duel__glow" aria-hidden="true"></div>
      <div class="final-duel__avatar">${initials(player.name)}</div>
      <h3 class="final-duel__name">${player.name}</h3>
      ${pickHtml}
      ${status ? `<span class="final-duel__status ${statusClass}">${status}</span>` : ""}
      <div class="final-duel__health"><div class="final-duel__health-bar"></div></div>
    </div>`;
  }

  const sub = roundLabel
    ? `${roundLabel} decides the champion — one pick, one survivor.`
    : "Two fighters remain. One pick decides it all.";

  return `<div class="final-duel mk-panel animate-fight">
    <header class="final-duel__header">
      <p class="final-duel__eyebrow">Head to head</p>
      <h2 class="final-duel__title">⚔ Final Kombat ⚔</h2>
      <p class="final-duel__sub">${sub}</p>
    </header>
    <div class="final-duel__arena">
      ${fighterSide(playerA, "left")}
      <div class="final-duel__center">
        <span class="final-duel__vs">VS</span>
        <span class="final-duel__spark" aria-hidden="true">✦</span>
      </div>
      ${fighterSide(playerB, "right")}
    </div>
  </div>`;
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
      ? `<p class="fighter-card__pick-hidden">Picked</p>`
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
    return `<span class="pick-badge pick-badge--hidden" title="Revealed after deadline">PICKED</span>`;
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

  const currentRoundPicksRevealed = areRoundPicksRevealed(
    resolved.currentRound,
    matches,
    Date.now(),
    activeScheduleOptions,
  );
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
            const revealed = areRoundPicksRevealed(round, matches, Date.now(), activeScheduleOptions);
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
          ? alive.some((p) => {
              const pick = p.picks.find((pk) => pk.round === resolved.currentRound);
              return pick?.teamId === team.id;
            })
            ? "Picked"
            : "Available"
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

function updateCutoffDisplays(
  resolved: ResolvedGame,
  matches: RoundMatch[],
) {
  if (resolved.schedule) {
    const { cutoffAt, firstKickoffAt, firstMatchNumber } = resolved.schedule;
    const cutoffLabel = formatScheduleTime(cutoffAt);
    const kickoffLabel = formatScheduleTime(firstKickoffAt);
    const detailText =
      resolved.currentRound === 1
        ? `Deadline 20:00 UK · First match #${firstMatchNumber} at ${kickoffLabel}`
        : `90 min before first kick-off · Match #${firstMatchNumber} at ${kickoffLabel}`;

    document.querySelectorAll(".round-cutoff").forEach((el) => {
      (el as HTMLElement).dataset.cutoffAt = cutoffAt;
      const timeEl = el.querySelector(".round-cutoff__time");
      if (timeEl) timeEl.textContent = cutoffLabel;
      const detailEl = el.querySelector(".round-cutoff__detail");
      if (detailEl) detailEl.textContent = detailText;
    });
  }

  document.querySelectorAll(".timeline__round").forEach((el) => {
    const round = Number((el as HTMLElement).dataset.round);
    const schedule = getRoundSchedule(round, matches, activeScheduleOptions);
    if (!schedule) return;

    const cutoffEl = el.querySelector(".timeline__cutoff");
    if (cutoffEl) {
      cutoffEl.textContent = `Picks close ${formatScheduleTime(schedule.cutoffAt)}`;
    }
    const opensEl = el.querySelector(".timeline__opens");
    if (opensEl) {
      opensEl.textContent = `Opens ${formatScheduleTime(schedule.opensAt)}`;
    }
  });
}

function applyResolvedState(resolved: ResolvedGame, config: GameConfig, matches: RoundMatch[]) {
  const alive = resolved.players.filter((p) => !p.eliminated && p.name !== "—");
  const eliminated = resolved.players.filter((p) => p.eliminated);

  const enterCta = document.getElementById("lms-enter-cta") as HTMLElement | null;
  if (enterCta) {
    enterCta.hidden = !resolved.picksOpen;
    enterCta.style.display = resolved.picksOpen ? "" : "none";
    const textEl = enterCta.querySelector("[data-lms-enter-cta-text]");
    if (textEl) {
      textEl.textContent =
        resolved.currentRound === 8
          ? "Rollover — everyone picks again for the 3rd-place play-off."
          : resolved.currentRound === config.totalRounds
            ? "Final picks are open to 3rd-place survivors until 90 minutes before kick-off."
            : `Round ${resolved.currentRound} picks are open — submit your team before the deadline.`;
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

  updateCutoffDisplays(resolved, matches);

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

  const picksRevealed = areRoundPicksRevealed(
    resolved.currentRound,
    matches,
    Date.now(),
    activeScheduleOptions,
  );

  const finalTwo = getFinalTwo(resolved);
  const survivorsArea = document.getElementById("lms-survivors-area");
  if (survivorsArea) {
    if (finalTwo && !resolved.winner) {
      const roundLabel = getRoundInfo(resolved.currentRound)?.name;
      survivorsArea.innerHTML = renderFinalDuel(
        finalTwo[0],
        finalTwo[1],
        config.teams,
        resolved.currentRound,
        picksRevealed,
        roundLabel,
      );
    } else {
      const survivors = document.getElementById("lms-survivors");
      if (survivors) {
        survivors.innerHTML = alive
          .map(
            (player, i) =>
              `<div class="animate-slide-up" style="animation-delay: ${i * 0.1}s">${renderFighterCard(player, config.teams, resolved.currentRound, true, picksRevealed)}</div>`,
          )
          .join("");
      } else {
        const title = survivorsArea.dataset.survivorsTitle ?? "Survivors";
        const titleClass = survivorsArea.dataset.survivorsTitleClass ?? "section-title mk-gold-text";
        survivorsArea.innerHTML = `<h2 class="${titleClass}">${title}</h2>
          <div class="fighter-grid" id="lms-survivors">${alive
            .map(
              (player, i) =>
                `<div class="animate-slide-up" style="animation-delay: ${i * 0.1}s">${renderFighterCard(player, config.teams, resolved.currentRound, true, picksRevealed)}</div>`,
            )
            .join("")}</div>`;
      }
    }
  } else {
    const survivors = document.getElementById("lms-survivors");
    if (survivors) {
      survivors.innerHTML = alive
        .map(
          (player, i) =>
            `<div class="animate-slide-up" style="animation-delay: ${i * 0.1}s">${renderFighterCard(player, config.teams, resolved.currentRound, true, picksRevealed)}</div>`,
        )
        .join("");
    }
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
        getRoundPhase(round, matches, config.totalRounds, Date.now(), activeScheduleOptions),
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
  activeScheduleOptions = scheduleOptionsFromSettings(settings);
  const resolved = resolveGameState(
    players,
    matches,
    config.totalRounds,
    Date.now(),
    activeScheduleOptions,
  );
  applyResolvedState(resolved, config, matches);
  applyPrizeToDom(settings);
}

tickGameState();
setInterval(tickGameState, 30_000);
