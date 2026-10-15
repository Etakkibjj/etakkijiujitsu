const STORAGE_KEY = "mat-ocho-tournament-v1";
const EVENT_START = new Date("2026-11-14T15:00:00-03:00").getTime();
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
const DEFAULT_PARTICIPANTS = {
  iniciantes: [
    "LAUTI AGUIRRE",
    "AGUS VELAZQUEZ",
    "BENJAMIN DUVOBSKY",
    "",
    "CRISTHIAN PEREZ",
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
  ],
};
const ROSTER_MIGRATIONS = [
  { key: "ignacioLeguizamon", categoryId: "avanzados", participantIndex: 1 },
  { key: "danielGoldsman", categoryId: "iniciantes", participantIndex: 3 },
  { key: "felipeOrtiz", categoryId: "avanzados", participantIndex: 2 },
  { key: "cristhianPerez", categoryId: "iniciantes", participantIndex: 4 },
  {
    key: "removeAxelFurlan",
    categoryId: "iniciantes",
    participantIndex: 5,
    removeName: "AXEL FURLAN",
  },
  { key: "addGonzaloTunon", categoryId: "iniciantes", participantIndex: 5 },
  { key: "addJuanEspinosa", categoryId: "iniciantes", participantIndex: 6 },
  { key: "addAlejandroDelgado", categoryId: "avanzados", participantIndex: 4 },
  { key: "addAxelFurlanAdvanced", categoryId: "avanzados", participantIndex: 5 },
  {
    key: "moveDanielGoldsmanToAdvanced",
    categoryId: "avanzados",
    participantIndex: 3,
    moveFrom: { categoryId: "iniciantes", name: "DANIEL GOLDSMAN" },
  },
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
    migrations: Object.fromEntries(ROSTER_MIGRATIONS.map(({ key }) => [key, true])),
  };
}

function makeMessage(text) {
  const message = document.querySelector("#app-message");
  message.textContent = text;
  message.hidden = !text;
}

function normalizeCategory(source) {
  if (!source || !Array.isArray(source.participants) || source.participants.length !== 8) {
    throw new Error("La lista de competidores guardada no tiene el formato esperado.");
  }

  if (!source.participants.every((name) => typeof name === "string")) {
    throw new Error("Hay un nombre guardado con un formato no válido.");
  }

  if (!source.winners || typeof source.winners !== "object" || Array.isArray(source.winners)) {
    throw new Error("Los resultados guardados no tienen el formato esperado.");
  }
  if (
    source.matchDetails !== undefined
    && (!source.matchDetails || typeof source.matchDetails !== "object" || Array.isArray(source.matchDetails))
  ) {
    throw new Error("Los detalles de combate guardados no tienen el formato esperado.");
  }

  const category = {
    participants: source.participants,
    winners: {},
    matchDetails: {},
  };

  for (const match of MATCHES) {
    const winner = source.winners[match.id];
    if (winner !== undefined) {
      if (typeof winner !== "string" || !PARTICIPANT_IDS.has(winner)) {
        throw new Error("Hay un resultado guardado con un formato no válido.");
      }
      category.winners[match.id] = winner;
    }

    const details = source.matchDetails?.[match.id];
    if (details !== undefined) {
      if (
        !details
        || typeof details !== "object"
        || typeof details.submission !== "string"
        || typeof details.overtime !== "boolean"
        || typeof details.overtimeScore !== "string"
      ) {
        throw new Error("Hay detalles de combate guardados con un formato no válido.");
      }
      category.matchDetails[match.id] = {
        submission: details.submission.slice(0, 80),
        overtime: details.overtime,
        overtimeScore: details.overtimeScore.slice(0, 30),
      };
    } else {
      category.matchDetails[match.id] = emptyMatchDetails();
    }
  }

  for (const match of MATCHES) {
    const winner = category.winners[match.id];
    if (!winner) continue;
    const entrants = getEntrants(category, match);
    if (
      entrants.some((participantId) => !participantId)
      || !entrants.includes(winner)
      || entrants.some((participantId) => !participantName(category, participantId))
    ) {
      delete category.winners[match.id];
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
      throw new Error("Los datos guardados no tienen el formato esperado.");
    }

    const loadedState = {
      iniciantes: normalizeCategory(parsed.iniciantes),
      avanzados: normalizeCategory(parsed.avanzados),
      migrations: parsed.migrations && typeof parsed.migrations === "object"
        ? parsed.migrations
        : {},
    };
    let migrationApplied = false;
    let rosterUpdated = false;
    for (const { key, categoryId, participantIndex, removeName, moveFrom } of ROSTER_MIGRATIONS) {
      if (!loadedState.migrations[key]) {
        migrationApplied = true;
        const targetCategory = loadedState[categoryId];
        const participant = targetCategory.participants[participantIndex];
        if (removeName && removeName === participant.trim()) {
          targetCategory.participants[participantIndex] = "";
          rosterUpdated = true;
        } else if (moveFrom) {
          const { categoryId: sourceCategoryId, name } = moveFrom;
          const sourceCategory = loadedState[sourceCategoryId];
          const sourceIndex = sourceCategory.participants.findIndex(
            (savedName) => savedName.trim() === name,
          );
          const targetIndex = targetCategory.participants[participantIndex].trim()
            ? targetCategory.participants.findIndex((savedName) => !savedName.trim())
            : participantIndex;
          const alreadyInTarget = targetCategory.participants.some(
            (savedName) => savedName.trim() === name,
          );
          if (sourceIndex !== -1 && (targetIndex !== -1 || alreadyInTarget)) {
            if (!alreadyInTarget) targetCategory.participants[targetIndex] = name;
            sourceCategory.participants[sourceIndex] = "";
            const affectedMatch = MATCHES.find((match) => match.sources.includes(`p${sourceIndex}`));
            if (affectedMatch) {
              delete sourceCategory.winners[affectedMatch.id];
              sourceCategory.matchDetails[affectedMatch.id] = emptyMatchDetails();
              clearDownstreamResults(sourceCategory, affectedMatch.id);
            }
            rosterUpdated = true;
          } else if (sourceIndex === -1 && !alreadyInTarget && targetIndex !== -1) {
            targetCategory.participants[targetIndex] = name;
            rosterUpdated = true;
          }
        } else {
          const defaultName = DEFAULT_PARTICIPANTS[categoryId][participantIndex]?.trim();
          const alreadyRegistered = defaultName
            && targetCategory.participants.some((savedName) => savedName.trim() === defaultName);
          const targetIndex = !participant.trim()
            ? participantIndex
            : targetCategory.participants.findIndex((savedName) => !savedName.trim());
          if (defaultName && !alreadyRegistered && targetIndex !== -1) {
            targetCategory.participants[targetIndex] = defaultName;
            rosterUpdated = true;
          }
        }
        loadedState.migrations[key] = true;
      }
    }
    if (migrationApplied) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedState));
      } catch (error) {
        if (rosterUpdated) {
          makeMessage(`No se pudo guardar la nueva lista en este dispositivo. ${error.message}`);
        }
      }
    }
    return loadedState;
  } catch (error) {
    makeMessage(
      `No se pudieron cargar los datos guardados. Se inició un torneo vacío. ${error.message}`,
    );
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

    const nameLabel = document.createElement("span");
    nameLabel.textContent = name || "Por definir";
    entrant.append(nameLabel);
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
  document.querySelector(`#count-${categoryId}`).textContent = `${registered} / 8`;
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
  document.querySelector("#participant-total").replaceChildren(
    document.createTextNode(`${participants} `),
    Object.assign(document.createElement("small"), { textContent: "/ 16" }),
  );
  document.querySelector("#match-total").replaceChildren(
    document.createTextNode(`${matches} `),
    Object.assign(document.createElement("small"), { textContent: "/ 14" }),
  );
  for (const categoryId of CATEGORY_IDS) {
    const registered = state[categoryId].participants.filter((name) => name.trim()).length;
    document.querySelector(`#available-${categoryId}`).textContent = String(8 - registered);
  }
}

function updateEventCountdown() {
  const remaining = EVENT_START - Date.now();
  const values = document.querySelector("#countdown-values");
  const started = document.querySelector("#countdown-started");
  const label = document.querySelector("#countdown-label");

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
  document.querySelector('[data-countdown="days"]').textContent = String(days);
  document.querySelector('[data-countdown="hours"]').textContent = String(hours).padStart(2, "0");
  document.querySelector('[data-countdown="minutes"]').textContent = String(minutes).padStart(2, "0");
}

function render() {
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
  const scoreInput = input.closest(".match-card").querySelector('[data-match-field="overtimeScore"]');
  scoreInput.disabled = !details.overtime;
  if (!details.overtime) scoreInput.value = "";
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
    document.querySelector(
      `[data-category="${categoryId}"][data-participant="${index}"]`,
    ).value = name;
  });
}
render();
