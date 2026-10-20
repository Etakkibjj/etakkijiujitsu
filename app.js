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
    "", // Cristhian Perez removido de aquí
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
    "CIRO CESPEDES", // Ciro Céspedes agregado aquí
  ],
};

const ROSTER_MIGRATIONS = [
  { key: "ignacioLeguizamon", categoryId: "avanzados", participantIndex: 1 },
  { key: "danielGoldsman", categoryId: "iniciantes", participantIndex: 3 },
  { key: "felipeOrtiz", categoryId: "avanzados", participantIndex: 2 },
  { key: "removeCristhianPerez", categoryId: "iniciantes", participantIndex: 4, removeName: "CRISTHIAN PEREZ" },
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
  { key: "addCiroCespedesAdvanced", categoryId: "avanzados", participantIndex: 6 },
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
  if (message) {
    message.textContent = text;
    message.hidden = !text;
  }
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
