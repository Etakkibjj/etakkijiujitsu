const STORAGE_KEY = "mat-ocho-tournament-v1";
const EVENT_START = new Date("2026-11-14T13:00:00-03:00").getTime();
const CATEGORY_IDS = ["iniciantes", "avanzados"];
const MATCHES = [
  { id: "q1", round: "Cuartos de final", number: "01", sources: ["p0", "p1"] },
  { id: "q2", round: "Cuartos de final", number: "02", sources: ["p2", "p3"] },
  { id: "q3", round: "Cuartos de final", number: "03", sources: ["p4", "p5"] },
  { id: "q4", round: "Cuartos de final", number: "04", sources: ["p6", "p7"] },
  { id: "s1", round: "Semifinales", number: "01", sources: ["q1", "q2"] },
  { id: "s2", round: "Semifinales", number: "02", sources: ["q3", "q4"] },
  { id: "f1", round: "Final", number: "01", sources: ["s1", "s2"] },
];
const MATCH_BY_ID = new Map(MATCHES.map((match) => [match.id, match]));
const PARTICIPANT_IDS = new Set(Array.from({ length: 8 }, (_, index) => `p${index}`));
const DOWNSTREAM_MATCHES = {
  q1: ["s1", "f1"],
  q2: ["s1", "f1"],
  q3: ["s2", "f1"],
  q4: ["s2", "f1"],
  s1: ["f1"],
  s2: ["f1"],
  f1: [],
};
const ROUNDS = [
  { label: "CUARTOS DE FINAL", matchIds: ["q1", "q2", "q3", "q4"] },
  { label: "SEMIFINALES", matchIds: ["s1", "s2"] },
  { label: "FINAL", matchIds: ["f1"] },
];

// LISTA ACTUALIZADA DE PARTICIPANTES
const DEFAULT_PARTICIPANTS = {
  iniciantes: [
    "LAUTI AGUIRRE",
    "AGUSTIN VELAZQUEZ",
    "BENJAMIN DUVOBSKY",
    "",
    "",
    "GONZALO TUÑÓN",
    "JUAN ESPINOSA",
  ],
  avanzados: [
    "EZEQUIEL MURACCIOLE",
    "IGNACIO LEGUIZAMÓN",
    "FELIPE ORTIZ",
    "DANIEL GOLDSMAN",
    "ALEJANDRO DELGADO",
    "AXEL FURLAN",
    "CIRO CESPEDES",
  ],
};

const ROSTER_MIGRATIONS = [
  { key: "v2-update-rosters-ciro", categoryId: "avanzados", participantIndex: 6, forceName: "CIRO CESPEDES" }
];

function emptyCategory(categoryId) {
  return {
    participants: Array.from(
      { length: 8 },
      (_, index) => DEFAULT_PARTICIPANTS[categoryId]?.[index] || "",
    ),
    winners: {},
    matchDetails: Object.fromEntries(
      MATCHES.map((match) => [match.id, emptyMatchDetails()]),
    ),
  };
}

function emptyMatchDetails() {
  return { submission: "", overtime: false, overtimeScore: "" };
}

function emptyState() {
  return {
    iniciantes: emptyCategory("iniciantes"),
    avanzados: emptyCategory("avanzados"),
    migrations: {},
  };
}

function makeMessage(text) {
  const message = document.querySelector("#app-message");
  if (message) {
    message.textContent = text;
    message.hidden = !text;
  }
}

function normalizeCategory(source, categoryId) {
  if (!source || !Array.isArray(source.participants) || source.participants.length !== 8) {
    return emptyCategory(categoryId);
  }

  const category = {
    participants: source.participants.map((name, index) => typeof name === "string" ? name : (DEFAULT_PARTICIPANTS[categoryId]?.[index] || "")),
    winners: {},
    matchDetails: {},
  };

  for (const match of MATCHES) {
    const winner = source.winners?.[match.id];
    if (winner !== undefined && PARTICIPANT_IDS.has(winner)) {
      category.winners[match.id] = winner;
    }

    const details = source.matchDetails?.[match.id];
    if (details && typeof details === "object") {
      category.matchDetails[match.id] = {
        submission: typeof details.submission === "string" ? details.submission.slice(0, 80) : "",
        overtime: Boolean(details.overtime),
        overtimeScore: typeof details.overtimeScore === "string" ? details.overtimeScore.slice(0, 30) : "",
      };
    } else {
      category.matchDetails[match.id] = emptyMatchDetails();
    }
  }

  return category;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyState();

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") {
      return emptyState();
    }

    const loadedState = {
      iniciantes: normalizeCategory(parsed.iniciantes, "iniciantes"),
      avanzados: normalizeCategory(parsed.avanzados, "avanzados"),
      migrations: parsed.migrations && typeof parsed.migrations === "object"
        ? parsed.migrations
        : {},
    };

    // Forzar actualización de participantes por defecto si no se aplicó la migración
    for (const { key, categoryId, participantIndex, forceName } of ROSTER_MIGRATIONS) {
      if (!loadedState.migrations[key]) {
        if (forceName) {
          loadedState[categoryId].participants[participantIndex] = forceName;
        }
        loadedState.migrations[key] = true;
      }
    }

    // Asegurar que Cristhian Pérez no quede colgado en iniciantes si estaba guardado
    loadedState.iniciantes.participants = loadedState.iniciantes.participants.map(name => 
      name.trim().toUpperCase() === "CRISTHIAN PEREZ" ? "" : name
    );

    return loadedState;
  } catch (error) {
    return emptyState();
  }
}

const state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    makeMessage("");
    return true;
  } catch (error) {
    makeMessage(`No se pudo guardar en este dispositivo. ${error.message}`);
    return false;
  }
}

function participantName(category, participantId) {
  if (!participantId || !PARTICIPANT_IDS.has(participantId)) return "";
  return category.participants[Number(participantId.slice(1))].trim();
}

function getEntrants(category, match) {
  return match.sources.map((sourceId) => {
    if (PARTICIPANT_IDS.has(sourceId)) return sourceId;
    return category.winners[sourceId] || null;
  });
}

function clearDownstreamResults(category, matchId) {
  for (const downstreamId of DOWNSTREAM_MATCHES[matchId]) {
    delete category.winners[downstreamId];
    category.matchDetails[downstreamId] = emptyMatchDetails();
  }
}

function createRoster(categoryId) {
  const container = document.querySelector(`#roster-${categoryId}`);
  if (!container) return;
  for (let index = 0; index < 8; index += 1) {
    const label = document.createElement("label");
    label.className = "roster-field";

    const labelText = document.createElement("span");
    labelText.textContent = `PLAZA ${String(index + 1).padStart(2, "0")}`;

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 60;
    input.autocomplete = "off";
    input.placeholder = `Competidor ${index + 1}`;
    input.setAttribute("aria-label", `Competidor ${index + 1}, categoría ${categoryId}`);
    input.dataset.category = categoryId;
    input.dataset.participant = String(index);

    label.append(labelText, input);
    container.append(label);
  }
}

// Función auxiliar para verificar si un luchador debe estar confirmado
function isConfirmedFighter(categoryId, name) {
  if (!name) return false;
  const normalized = name.trim().toUpperCase();
  if (categoryId === "avanzados") {
    return normalized === "ALEJANDRO DELGADO" || normalized === "CIRO CESPEDES" || normalized === "CIRO CÉSPEDES";
  }
  if (categoryId === "iniciantes") {
    return normalized === "AGUSTIN VELAZQUEZ" || normalized === "AGUS VELAZQUEZ";
  }
  return false;
}

function createMatchCard(categoryId, category, match) {
  const entrants = getEntrants(category, match);
  const isReady = entrants.every(
    (participantId) => participantId && participantName(category, participantId),
  );
  const winnerId = category.winners[match.id];
  const details = category.matchDetails[match.id];
  const card = document.createElement("article");
  card.className = `match-card ${winnerId ? "is-complete" : "is-pending"}`;

  const topLine = document.createElement("div");
  topLine.className = "match-topline";
  const label = document.createElement("span");
  label.className = "match-label";
  label.textContent = `${match.round} · ${match.number}`;
  const status = document.createElement("span");
  status.className = `match-status ${winnerId ? "is-winner" : ""}`;
  status.textContent = winnerId ? "CERRADO" : isReady ? "PENDIENTE" : "POR DEFINIR";
  topLine.append(label, status);
  card.append(topLine);

  entrants.forEach((participantId) => {
    const entrant = document.createElement("div");
    entrant.className = "match-entrant";
    const name = participantName(category, participantId);
    if (name) entrant.classList.add("has-name");
    if (participantId && participantId === winnerId) entrant.classList.add("is-winner");

    const entrantContent = document.createElement("span");
    entrantContent.className = "match-entrant-content";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = name || "Por definir";
    entrantContent.append(nameLabel);
    
    // Aplicar confirmación o leyenda de pendiente de verificación
    if (isConfirmedFighter(categoryId, name)) {
      entrant.classList.add("is-confirmed");
      const confirmation = document.createElement("span");
      confirmation.className = "entrant-confirmation";
      confirmation.setAttribute("aria-label", "Luchador confirmado");
      confirmation.textContent = "✓";
      entrantContent.append(confirmation);

      const confirmationLabel = document.createElement("span");
      confirmationLabel.className = "entrant-confirmation-label";
      confirmationLabel.textContent = "LUCHADOR CONFIRMADO";
      entrantContent.append(confirmationLabel);
    } else if (name) {
      const unverified = document.createElement("span");
      unverified.className = "entrant-unverified";
      unverified.style.color = "red";
      unverified.style.display = "block";
      unverified.style.fontSize = "0.85em";
      unverified.style.fontWeight = "bold";
      unverified.textContent = "❌ A ESPERA DE VERIFICACIÓN";
      entrantContent.append(unverified);
    }
    
    entrant.append(entrantContent);
    card.append(entrant);

    const button = document.createElement("button");
    button.className = `winner-button ${participantId === winnerId ? "is-selected" : ""}`;
    button.type = "button";
    button.dataset.action = "winner";
    button.dataset.category = categoryId;
    button.dataset.match = match.id;
    button.dataset.participant = participantId || "";
    button.setAttribute("aria-pressed", String(Boolean(participantId && participantId === winnerId)));
    button.disabled = !isReady || !participantId;
    if (participantId === winnerId) {
      button.textContent = "✓ Ganador";
    } else if (winnerId) {
      button.textContent = "Elegir ganador";
    } else {
      button.textContent = "Registrar victoria por sumisión";
    }
    card.append(button);
  });

  const detailFields = document.createElement("div");
  detailFields.className = "match-details";

  const submissionLabel = document.createElement("label");
  submissionLabel.className = "match-field";
  const submissionTitle = document.createElement("span");
  submissionTitle.textContent = "SUMISIÓN";
  const submissionInput = document.createElement("input");
  submissionInput.type = "text";
  submissionInput.maxLength = 80;
  submissionInput.placeholder = "Tipo de sumisión";
  submissionInput.value = details.submission;
  submissionInput.dataset.category = categoryId;
  submissionInput.dataset.match = match.id;
  submissionInput.dataset.matchField = "submission";
  submissionInput.setAttribute("aria-label", `Sumisión del combate ${match.number}, ${match.round}`);
  submissionLabel.append(submissionTitle, submissionInput);

  const overtimeLabel = document.createElement("label");
  overtimeLabel.className = "overtime-toggle";
  const overtimeInput = document.createElement("input");
  overtimeInput.type = "checkbox";
  overtimeInput.checked = details.overtime;
  overtimeInput.dataset.category = categoryId;
  overtimeInput.dataset.match = match.id;
  overtimeInput.dataset.matchField = "overtime";
  overtimeInput.setAttribute("aria-label", `Combate ${match.number} fue a overtime`);
  const overtimeTitle = document.createElement("span");
  overtimeTitle.textContent = "OVERTIME";
  overtimeLabel.append(overtimeInput, overtimeTitle);

  const scoreLabel = document.createElement("label");
  scoreLabel.className = "match-field overtime-score";
  const scoreTitle = document.createElement("span");
  scoreTitle.textContent = "PUNTUACIÓN FINAL OVERTIME";
  const scoreInput = document.createElement("input");
  scoreInput.type = "text";
  scoreInput.maxLength = 30;
  scoreInput.placeholder = "Puntuación";
  scoreInput.value = details.overtimeScore;
  scoreInput.disabled = !details.overtime;
  scoreInput.dataset.category = categoryId;
  scoreInput.dataset.match = match.id;
  scoreInput.dataset.matchField = "overtimeScore";
  scoreInput.setAttribute("aria-label", `Puntuación final overtime del combate ${match.number}, ${match.round}`);
  scoreLabel.append(scoreTitle, scoreInput);

  detailFields.append(submissionLabel, overtimeLabel, scoreLabel);
  card.append(detailFields);

  const resetButton = document.createElement("button");
  resetButton.className = "match-reset-button";
  resetButton.type = "button";
  resetButton.dataset.action = "reset-match";
  resetButton.dataset.category = categoryId;
  resetButton.dataset.match = match.id;
  resetButton.textContent = "Reiniciar resultado de esta lucha";
  card.append(resetButton);

  return card;
}

function renderBracket(categoryId) {
  const category = state[categoryId];
  const container = document.querySelector(`#bracket-${categoryId}`);
  if (!container) return;
  container.replaceChildren();

  for (const round of ROUNDS) {
    const column = document.createElement("div");
    column.className = "round-column";

    const title = document.createElement("div");
    title.className = "round-title";
    const label = document.createElement("span");
    label.textContent = round.label;
    const count = document.createElement("small");
    const completed = round.matchIds.filter((matchId) => category.winners[matchId]).length;
    count.textContent = `${completed}/${round.matchIds.length}`;
    title.append(label, count);
    column.append(title);

    for (const matchId of round.matchIds) {
      column.append(createMatchCard(categoryId, category, MATCH_BY_ID.get(matchId)));
    }
    container.append(column);
  }

  const registered = category.participants.filter((name) => name.trim()).length;
  const countEl = document.querySelector(`#count-${categoryId}`);
  if (countEl) countEl.textContent = `${registered} / 8`;
}

function renderSummary() {
  const participants = CATEGORY_IDS.reduce(
    (total, categoryId) => total + state[categoryId].participants.filter((name) => name.trim()).length,
    0,
  );
  const matches = CATEGORY_IDS.reduce(
    (total, categoryId) => total + Object.keys(state[categoryId].winners).length,
    0,
  );
  const partTotalEl = document.querySelector("#participant-total");
  if (partTotalEl) {
    partTotalEl.replaceChildren(
      document.createTextNode(`${participants} `),
      Object.assign(document.createElement("small"), { textContent: "/ 16" }),
    );
  }
  const matchTotalEl = document.querySelector("#match-total");
  if (matchTotalEl) {
    matchTotalEl.replaceChildren(
      document.createTextNode(`${matches} `),
      Object.assign(document.createElement("small"), { textContent: "/ 14" }),
    );
  }
  for (const categoryId of CATEGORY_IDS) {
    const registered = state[categoryId].participants.filter((name) => name.trim()).length;
    const availEl = document.querySelector(`#available-${categoryId}`);
    if (availEl) availEl.textContent = String(8 - registered);
  }
}

function updateEventCountdown() {
  const remaining = EVENT_START - Date.now();
  const values = document.querySelector("#countdown-values");
  const started = document.querySelector("#countdown-started");
  const label = document.querySelector("#countdown-label");

  if (!values || !started || !label) return;

  if (remaining <= 0) {
    values.hidden = true;
    started.hidden = false;
    label.textContent = "TORNEO EN CURSO";
    return;
  }

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  
  const daysEl = document.querySelector('[data-countdown="days"]');
  const hoursEl = document.querySelector('[data-countdown="hours"]');
  const minsEl = document.querySelector('[data-countdown="minutes"]');
  
  if (daysEl) daysEl.textContent = String(days);
  if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
  if (minsEl) minsEl.textContent = String(minutes).padStart(2, "0");
}

function renderRosterConfirmations(categoryId) {
  const rosterContainer = document.querySelector(`#roster-${categoryId}`);
  if (!rosterContainer) return;
  
  for (const field of rosterContainer.querySelectorAll(".roster-field")) {
    field.querySelector(".roster-confirmation")?.remove();
    field.querySelector(".roster-unverified")?.remove();
    const input = field.querySelector("input");
    if (!input || !input.value.trim()) continue;

    if (isConfirmedFighter(categoryId, input.value)) {
      const confirmation = document.createElement("span");
      confirmation.className = "roster-confirmation";
      const check = document.createElement("span");
      check.className = "roster-confirmation-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      const label = document.createElement("span");
      label.textContent = "LUCHADOR CONFIRMADO";
      confirmation.append(check, label);
      field.append(confirmation);
    } else {
      const unverified = document.createElement("span");
      unverified.className = "roster-unverified";
      unverified.style.color = "red";
      unverified.style.display = "block";
      unverified.style.fontSize = "0.85em";
      unverified.style.fontWeight = "bold";
      unverified.textContent = "❌ A ESPERA DE VERIFICACIÓN";
      field.append(unverified);
    }
  }
}

function render() {
  renderRosterConfirmations("avanzados");
  renderRosterConfirmations("iniciantes");

  for (const categoryId of CATEGORY_IDS) renderBracket(categoryId);
  renderSummary();
}

updateEventCountdown();
window.setInterval(updateEventCountdown, 1_000);

document.addEventListener("input", (event) => {
  const matchField = event.target.closest("[data-match-field]");
  if (matchField && matchField.dataset.matchField !== "overtime") {
    const category = state[matchField.dataset.category];
    const details = category.matchDetails[matchField.dataset.match];
    const field = matchField.dataset.matchField;
    details[field] = matchField.value.slice(0, field === "submission" ? 80 : 30);
    saveState();
    return;
  }

  const input = event.target.closest("[data-participant]");
  if (!input) return;

  const category = state[input.dataset.category];
  const index = Number(input.dataset.participant);
  const previousName = category.participants[index].trim();
  const nextName = input.value.slice(0, 60);
  category.participants[index] = nextName;

  if (previousName && previousName !== nextName.trim()) {
    const firstAffectedMatch = MATCHES.find((match) => match.sources.includes(`p${index}`));
    if (firstAffectedMatch) {
      clearDownstreamResults(category, firstAffectedMatch.id);
      delete category.winners[firstAffectedMatch.id];
      category.matchDetails[firstAffectedMatch.id] = emptyMatchDetails();
    }
  }

  saveState();
  render();
});

document.addEventListener("change", (event) => {
  const input = event.target.closest('[data-match-field="overtime"]');
  if (!input) return;

  const category = state[input.dataset.category];
  const details = category.matchDetails[input.dataset.match];
  details.overtime = input.checked;
  if (!details.overtime) details.overtimeScore = "";
  const scoreInput = input.closest(".match-card")?.querySelector('[data-match-field="overtimeScore"]');
  if (scoreInput) {
    scoreInput.disabled = !details.overtime;
    if (!details.overtime) scoreInput.value = "";
  }
  saveState();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const category = state[button.dataset.category];
  if (button.dataset.action === "winner") {
    const { match: matchId, participant: participantId } = button.dataset;
    const match = MATCH_BY_ID.get(matchId);
    const entrants = getEntrants(category, match);
    if (
      !participantId
      || !entrants.includes(participantId)
      || entrants.some((entrantId) => !participantName(category, entrantId))
    ) {
      return;
    }
    if (category.winners[matchId] !== participantId) {
      clearDownstreamResults(category, matchId);
      category.winners[matchId] = participantId;
      category.matchDetails[matchId] = emptyMatchDetails();
      saveState();
      render();
    }
    return;
  }

  if (button.dataset.action === "reset-match") {
    const { match: matchId, category: categoryId } = button.dataset;
    const categoryName = categoryId === "iniciantes" ? "Iniciantes" : "Avanzados";
    const match = MATCH_BY_ID.get(matchId);
    const details = category.matchDetails[matchId];
    const hasDetails = category.winners[matchId]
      || details.submission
      || details.overtime
      || details.overtimeScore;
    if (
      hasDetails
      && !window.confirm(
        `¿Reiniciar el resultado de ${match.round.toLowerCase()} ${match.number} de ${categoryName}? También se borrarán los resultados de las luchas posteriores.`,
      )
    ) {
      return;
    }
    clearDownstreamResults(category, matchId);
    delete category.winners[matchId];
    category.matchDetails[matchId] = emptyMatchDetails();
    saveState();
    render();
    return;
  }

  if (button.dataset.action === "reset") {
    const categoryId = button.dataset.category;
    const categoryName = categoryId === "iniciantes" ? "Iniciantes" : "Avanzados";
    if (!window.confirm(`¿Reiniciar la categoría ${categoryName}? Se borrarán sus nombres y resultados.`)) {
      return;
    }
    state[categoryId] = emptyCategory(categoryId);
    document.querySelectorAll(`[data-category="${categoryId}"][data-participant]`).forEach((input) => {
      input.value = state[categoryId].participants[Number(input.dataset.participant)];
    });
    saveState();
    render();
  }
});

for (const categoryId of CATEGORY_IDS) {
  createRoster(categoryId);
  state[categoryId].participants.forEach((name, index) => {
    const inputEl = document.querySelector(`[data-category="${categoryId}"][data-participant="${index}"]`);
    if (inputEl) inputEl.value = name;
  });
}
render();
