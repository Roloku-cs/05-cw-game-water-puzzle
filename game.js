const STAGE_WIDTH = 1200;
const STAGE_HEIGHT = 800;
const GRID_UNIT = 100;
const SNAP_THRESHOLD = 34;
const CONNECT_THRESHOLD = 10;
const PIPE_SIZE = 200;
const CARD_HITBOX_WIDTH = 60;
const CARD_HITBOX_HEIGHT = 60;
const DEBUG_COORDS = true;
const SOURCE_OUTLET_OFFSET_X = 0;
const TARGET_INLET_OFFSET_X = 42;

const PIPE_TYPES = {
  straight: {
    label: "Straight",
    ports: [
      { x: 0, y: -0.5 },
      { x: 0, y: 0.5 },
    ],
    segments: [[0, -0.5, 0, 0.5]],
  },
  elbow: {
    label: "Elbow",
    ports: [
      { x: -1, y: 0 },
      { x: 0, y: 1 },
    ],
    segments: [
      [-1, 0, 0, 0],
      [0, 0, 0, 1],
    ],
  },
  tee: {
    label: "T-Junction",
    ports: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    ],
    segments: [
      [-1, 0, 1, 0],
      [0, -1, 0, 0],
    ],
  },
  cross: {
    label: "Cross",
    ports: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ],
    segments: [
      [-1, 0, 1, 0],
      [0, -1, 0, 1],
    ],
  },
};

const LEVELS = [
  {
    name: "Level 1 - First Mile",
    minScore: 3,
    requireBucket: true,
    source: { x: 200, y: 200 },
    targets: [
      { id: "cup-a", kind: "cup", label: "Cup A", x: 300, y: 200 },
      { id: "cup-b", kind: "cup", label: "Cup B", x: 1000, y: 200 },
      { id: "cup-c", kind: "cup", label: "Cup C", x: 300, y: 600 },
      { id: "bucket", kind: "bucket", label: "Storage Tank", x: 1000, y: 600 },
    ],
  },
  {
    name: "Level 2 - Expanding Access",
    minScore: 6,
    requireBucket: true,
    pipeUsagePenalty: true,
    source: { x: 200, y: 400 },
    targets: [
      { id: "cup-a", kind: "cup", label: "Cup A", x: 400, y: 200 },
      { id: "cup-b", kind: "cup", label: "Cup B", x: 800, y: 300 },
      { id: "cup-c", kind: "cup", label: "Cup C", x: 400, y: 600 },
      { id: "bucket", kind: "bucket", label: "Storage Tank", x: 800, y: 500 },
    ],
    walls: [
      {
        path: [
          { x: 500, y: 200 },
          { x: 500, y: 450 },
          { x: 700, y: 450 },
        ],
      },
      {
        path: [
          { x: 300, y: 300 },
          { x: 300, y: 550 },
        ],
      },
    ],
  },
  {
    name: "Level 3 - Global Network",
    minScore: 12,
    requireBucket: true,
    pipeLimit: 8,
    source: { x: 200, y: 600 },
    targets: [
      { id: "cup-a", kind: "cup", label: "Cup A", x: 500, y: 200 },
      { id: "cup-b", kind: "cup", label: "Cup B", x: 1000, y: 300 },
      { id: "cup-c", kind: "cup", label: "Cup C", x: 300, y: 500 },
      { id: "bucket", kind: "bucket", label: "Storage Tank", x: 900, y: 400 },
    ],
    walls: [
      {
        path: [
          { x: 400, y: 100 },
          { x: 400, y: 350 },
        ],
      },
      {
        path: [
          { x: 700, y: 450 },
          { x: 700, y: 700 },
        ],
      },
      {
        path: [
          { x: 600, y: 150 },
          { x: 900, y: 150 },
        ],
      },
      {
        path: [
          { x: 800, y: 600 },
          { x: 1100, y: 600 },
        ],
      },
    ],
  },
];

const state = {
  currentLevelIndex: 0,
  pipes: [],
  nextPipeId: 1,
  selectedType: "straight",
  selectedRotation: 0,
  selectedPipeId: null,
  eraseMode: false,
  showPreview: false,
  showGrid: false,
  hasShownLevelPopup: false,
  pipeTypeUsage: {
    straight: 0,
    elbow: 0,
    tee: 0,
    cross: 0,
  },
  drag: {
    active: false,
    pointerId: null,
    pipeId: null,
    offsetX: 0,
    offsetY: 0,
    fromToolbox: false,
  },
  results: {
    score: 0,
    fills: new Map(),
    reachedPipeIds: new Set(),
    connectorEdges: [],
    flowEdges: [],
  },
};

const refs = {
  levelName: document.getElementById("levelName"),
  levelRules: document.getElementById("levelRules"),
  scoreValue: document.getElementById("scoreValue"),
  endpointStatus: document.getElementById("endpointStatus"),
  runWaterButton: document.getElementById("runWaterButton"),
  resetLevelButton: document.getElementById("resetLevelButton"),
  restartGameButton: document.getElementById("restartGameButton"),
  pipeOptions: document.getElementById("pipeOptions"),
  rotatePieceButton: document.getElementById("rotatePieceButton"),
  eraseModeButton: document.getElementById("eraseModeButton"),
  toggleGridButton: document.getElementById("toggleGridButton"),
  modal: document.getElementById("gameModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage"),
  modalActions: document.getElementById("modalActions"),
  helpButton: document.getElementById("helpButton"),
  helpModal: document.getElementById("helpModal"),
  helpModalContent: document.getElementById("helpModalContent"),
  helpModalActions: document.getElementById("helpModalActions"),
  stage: document.getElementById("freeflowStage"),
  sourceNode: document.getElementById("sourceNode"),
  targetNodes: document.getElementById("targetNodes"),
  gridSvg: document.getElementById("gridSvg"),
  pipeLayer: document.getElementById("pipeLayer"),
  flowSvg: document.getElementById("flowSvg"),
};

function getLevel() {
  return LEVELS[state.currentLevelIndex];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stageXPercent(x) {
  return `${(x / STAGE_WIDTH) * 100}%`;
}

function stageYPercent(y) {
  return `${(y / STAGE_HEIGHT) * 100}%`;
}

function stageWidthPercent(size) {
  return `${(size / STAGE_WIDTH) * 100}%`;
}

function stageHeightPercent(size) {
  return `${(size / STAGE_HEIGHT) * 100}%`;
}

function logDebug(label, payload) {
  if (!DEBUG_COORDS) {
    return;
  }
  console.log(`[AquaMaze] ${label}`, payload);
}

function getSourceAnchor(level) {
  return {
    x: level.source.x + SOURCE_OUTLET_OFFSET_X,
    y: level.source.y,
  };
}

function getTargetAnchor(target) {
  return {
    x: target.x - TARGET_INLET_OFFSET_X,
    y: target.y,
  };
}

function localToWorld(pipe, localPoint) {
  const angle = toRadians(pipe.rotation);
  const scale = PIPE_SIZE / 2;
  const x = localPoint.x * scale;
  const y = localPoint.y * scale;
  return {
    x: pipe.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: pipe.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

function clientToStage(clientX, clientY) {
  const rect = refs.stage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * STAGE_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * STAGE_HEIGHT;
  return {
    x: clamp(x, 20, STAGE_WIDTH - 20),
    y: clamp(y, 20, STAGE_HEIGHT - 20),
  };
}

function clearResults() {
  state.results = {
    score: 0,
    fills: new Map(),
    reachedPipeIds: new Set(),
    connectorEdges: [],
    flowEdges: [],
  };
}

function createPipe(type, x, y, rotation) {
  return {
    id: state.nextPipeId++,
    type,
    x,
    y,
    rotation,
  };
}

function getPipePorts(pipe) {
  const def = PIPE_TYPES[pipe.type];
  return def.ports.map((port, index) => ({
    id: `p${pipe.id}-${index}`,
    pipeId: pipe.id,
    portIndex: index,
    point: localToWorld(pipe, port),
  }));
}

function getConnectionCandidates(excludePipeId) {
  const level = getLevel();
  const candidates = [];

  const sourceAnchor = getSourceAnchor(level);
  candidates.push({
    id: "source",
    kind: "source",
    point: sourceAnchor,
  });

  level.targets.forEach((target) => {
    candidates.push({
      id: `target-${target.id}`,
      kind: "target",
      targetId: target.id,
      point: getTargetAnchor(target),
    });
  });

  state.pipes.forEach((pipe) => {
    if (pipe.id === excludePipeId) {
      return;
    }
    getPipePorts(pipe).forEach((port) => {
      candidates.push({
        id: port.id,
        kind: "pipe",
        pipeId: pipe.id,
        point: port.point,
      });
    });
  });

  return candidates;
}

function snapPipe(pipe) {
  const ports = getPipePorts(pipe);
  const candidates = getConnectionCandidates(pipe.id);
  let best = null;

  ports.forEach((port) => {
    candidates.forEach((candidate) => {
      const d = distance(port.point, candidate.point);
      if (d <= SNAP_THRESHOLD && (!best || d < best.distance)) {
        best = {
          distance: d,
          port,
          candidate,
        };
      }
    });
  });

  if (!best) {
    return;
  }

  const dx = best.candidate.point.x - best.port.point.x;
  const dy = best.candidate.point.y - best.port.point.y;
  pipe.x = clamp(pipe.x + dx, 30, STAGE_WIDTH - 30);
  pipe.y = clamp(pipe.y + dy, 30, STAGE_HEIGHT - 30);
}

function renderPipeOptions() {
  refs.pipeOptions.innerHTML = "";
  const level = getLevel();

  Object.entries(PIPE_TYPES).forEach(([type, def]) => {
    const button = document.createElement("button");
    button.className = "pipe-option";
    if (state.selectedType === type) {
      button.classList.add("is-selected");
    }
    button.type = "button";

    const symbol = document.createElement("span");
    symbol.className = "pipe-option-symbol";
    symbol.textContent = getPipeSymbol(type, state.selectedRotation);

    const label = document.createElement("span");
    label.textContent = def.label;

    // Add pipe limit counter for Level 3
    if (level.pipeLimit) {
      const remaining = level.pipeLimit - state.pipeTypeUsage[type];
      const counter = document.createElement("span");
      counter.className = "pipe-option-counter";
      counter.textContent = `(${remaining})`;
      label.appendChild(counter);
      
      // Disable button if limit reached
      if (remaining <= 0) {
        button.disabled = true;
        button.style.opacity = "0.5";
        button.style.cursor = "not-allowed";
      }
    }

    button.appendChild(symbol);
    button.appendChild(label);

    button.addEventListener("click", () => {
      state.selectedType = type;
      state.eraseMode = false;
      refs.eraseModeButton.classList.remove("is-erase-mode");
      renderPipeOptions();
    });

    button.addEventListener("pointerdown", (event) => {
      startDragFromToolbox(type, event);
    });

    refs.pipeOptions.appendChild(button);
  });
}

function getPipeSymbol(type, rotation) {
  const def = PIPE_TYPES[type];
  const conns = def.ports.map((port) => {
    const angle = (toDegrees(Math.atan2(port.y, port.x)) + 360 + rotation) % 360;
    if (angle < 45 || angle >= 315) {
      return "E";
    }
    if (angle < 135) {
      return "S";
    }
    if (angle < 225) {
      return "W";
    }
    return "N";
  });
  const key = [...new Set(conns)].sort().join("");
  const map = {
    E: "▶",
    N: "▲",
    S: "▼",
    W: "◀",
    EW: "─",
    NS: "│",
    ES: "┌",
    EN: "└",
    SW: "┐",
    NW: "┘",
    ENS: "├",
    ENW: "┴",
    NSW: "┤",
    ESW: "┬",
    ENSW: "┼",
  };
  return map[key] || "•";
}

function renderStageNodes() {
  const level = getLevel();
  refs.sourceNode.style.left = stageXPercent(level.source.x);
  refs.sourceNode.style.top = stageYPercent(level.source.y);

  refs.targetNodes.innerHTML = "";
  level.targets.forEach((target) => {
    const node = document.createElement("div");
    node.className = "stage-node target-node";
    node.style.left = stageXPercent(target.x);
    node.style.top = stageYPercent(target.y);

    const fill = state.results.fills.get(target.id) || 0;
    node.style.setProperty("--fill", String(fill / 100));
    if (fill > 0) {
      node.classList.add("is-filled");
    }

    const icon = document.createElement("span");
    icon.className = "target-icon";
    icon.textContent = target.kind === "bucket" ? "🪣" : "🥤";

    const label = document.createElement("span");
    label.className = "target-label";
    label.textContent = target.label;

    node.appendChild(icon);
    node.appendChild(label);
    refs.targetNodes.appendChild(node);
  });
}

function renderWalls() {
  const level = getLevel();
  
  if (!level.walls) {
    return;
  }
  
  // Create or get SVG for walls (reuse gridSvg)
  const wallGroup = document.getElementById("wallGroup");
  if (wallGroup) {
    wallGroup.innerHTML = "";
  }
  
  level.walls.forEach((wall) => {
    for (let i = 0; i < wall.path.length - 1; i++) {
      const start = wall.path[i];
      const end = wall.path[i + 1];
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", start.x);
      line.setAttribute("y1", start.y);
      line.setAttribute("x2", end.x);
      line.setAttribute("y2", end.y);
      line.setAttribute("class", "wall-line");
      
      // Get SVG or create wall group
      let svg = document.getElementById("wallGroup");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "wallGroup";
        svg.setAttribute("class", "wall-svg");
        svg.setAttribute("viewBox", "0 0 1200 800");
        svg.setAttribute("preserveAspectRatio", "none");
        refs.stage.insertBefore(svg, refs.pipeLayer);
      }
      
      svg.appendChild(line);
    }
  });
}

function renderPipeLayer() {
  refs.pipeLayer.innerHTML = "";

  state.pipes.forEach((pipe) => {
    const piece = document.createElement("div");
    piece.className = "pipe-piece";
    piece.dataset.pipeId = String(pipe.id);
    piece.style.left = stageXPercent(pipe.x);
    piece.style.top = stageYPercent(pipe.y);
    piece.style.width = stageWidthPercent(PIPE_SIZE);
    piece.style.height = stageHeightPercent(PIPE_SIZE);
    piece.style.transform = `translate(-50%, -50%) rotate(${pipe.rotation}deg)`;

    if (pipe.id === state.selectedPipeId) {
      piece.classList.add("is-selected");
    }
    if (state.results.reachedPipeIds.has(pipe.id)) {
      piece.classList.add("is-watered");
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-100 -100 200 200");
    svg.classList.add("pipe-svg");

    const segments = document.createElementNS("http://www.w3.org/2000/svg", "g");
    segments.classList.add("pipe-segments");

    PIPE_TYPES[pipe.type].segments.forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1 * 100));
      line.setAttribute("y1", String(y1 * 100));
      line.setAttribute("x2", String(x2 * 100));
      line.setAttribute("y2", String(y2 * 100));
      segments.appendChild(line);
    });

    const ports = document.createElementNS("http://www.w3.org/2000/svg", "g");
    ports.classList.add("pipe-ports");
    PIPE_TYPES[pipe.type].ports.forEach((port) => {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", String(port.x * 100));
      dot.setAttribute("cy", String(port.y * 100));
      dot.setAttribute("r", "10");
      ports.appendChild(dot);
    });

    svg.appendChild(segments);
    svg.appendChild(ports);
    piece.appendChild(svg);

    piece.addEventListener("pointerdown", (event) => {
      startDragExistingPipe(pipe.id, event);
    });

    refs.pipeLayer.appendChild(piece);
  });
}

function renderFlowLines() {
  refs.flowSvg.innerHTML = "";

  if (!state.showPreview) {
    return;
  }

  state.results.connectorEdges.forEach((edge) => {
    const connector = document.createElementNS("http://www.w3.org/2000/svg", "line");
    connector.setAttribute("x1", String(edge.a.x));
    connector.setAttribute("y1", String(edge.a.y));
    connector.setAttribute("x2", String(edge.b.x));
    connector.setAttribute("y2", String(edge.b.y));
    connector.classList.add("pipe-link-line");
    refs.flowSvg.appendChild(connector);
  });

  state.results.flowEdges.forEach((edge) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(edge.a.x));
    line.setAttribute("y1", String(edge.a.y));
    line.setAttribute("x2", String(edge.b.x));
    line.setAttribute("y2", String(edge.b.y));
    line.classList.add("flow-line");
    refs.flowSvg.appendChild(line);
  });
}

function renderGrid() {
  refs.gridSvg.innerHTML = "";

  if (!state.showGrid) {
    return;
  }

  const spacing = GRID_UNIT;
  
  // Draw vertical lines
  for (let x = 0; x <= STAGE_WIDTH; x += spacing) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("y1", "0");
    line.setAttribute("x2", String(x));
    line.setAttribute("y2", String(STAGE_HEIGHT));
    line.classList.add("grid-line");
    refs.gridSvg.appendChild(line);
  }

  // Draw horizontal lines
  for (let y = 0; y <= STAGE_HEIGHT; y += spacing) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", String(y));
    line.setAttribute("x2", String(STAGE_WIDTH));
    line.setAttribute("y2", String(y));
    line.classList.add("grid-line");
    refs.gridSvg.appendChild(line);
  }
}

function renderEndpointStatus() {
  const level = getLevel();
  refs.endpointStatus.innerHTML = "";

  level.targets.forEach((target) => {
    const fill = state.results.fills.get(target.id) || 0;
    const row = document.createElement("div");
    row.className = "endpoint-row";
    if (fill > 0) {
      row.classList.add("is-filled");
    }

    const name = document.createElement("span");
    name.className = "endpoint-name";
    name.textContent = target.label;

    const value = document.createElement("span");
    value.className = "endpoint-fill";
    value.textContent = `${fill}%`;

    row.appendChild(name);
    row.appendChild(value);
    refs.endpointStatus.appendChild(row);
  });
}

function renderScore() {
  let displayScore = state.results.score;
  const level = getLevel();
  
  // For Level 2, show real-time penalty calculation
  if (level.pipeUsagePenalty) {
    const totalPipes = Object.values(state.pipeTypeUsage).reduce((a, b) => a + b, 0);
    const penalty = Math.floor(totalPipes / 5);
    const baseScore = state.results.score + penalty; // Add penalty back to get base
    displayScore = Math.max(0, baseScore - penalty);
  }
  
  refs.scoreValue.textContent = String(displayScore);
}

function renderAll() {
  renderStageNodes();
  renderWalls();
  renderPipeLayer();
  renderGrid();
  renderFlowLines();
  renderEndpointStatus();
  renderScore();
  renderPipeOptions();
}

function updateRotateButtonLabel() {
  refs.rotatePieceButton.textContent = `Rotate Selected (${state.selectedRotation}°)`;
}

function startDragFromToolbox(type, event) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();

  const level = getLevel();
  
  // Check pipe limits for Level 3
  if (level.pipeLimit && state.pipeTypeUsage[type] >= level.pipeLimit) {
    logDebug("pipe-limit-reached", { type, limit: level.pipeLimit });
    return;
  }

  const point = clientToStage(event.clientX, event.clientY);
  const pipe = createPipe(type, point.x, point.y, state.selectedRotation);
  state.pipes.push(pipe);
  state.pipeTypeUsage[type]++;
  state.selectedPipeId = pipe.id;
  state.eraseMode = false;
  refs.eraseModeButton.classList.remove("is-erase-mode");

  state.drag.active = true;
  state.drag.pointerId = event.pointerId;
  state.drag.pipeId = pipe.id;
  state.drag.fromToolbox = true;
  state.drag.offsetX = 0;
  state.drag.offsetY = 0;

  logDebug("drag-start-toolbox", {
    type,
    pointer: { x: event.clientX, y: event.clientY },
    stage: point,
    rotation: state.selectedRotation,
  });

  refreshFlowPreview();
}

function startDragExistingPipe(pipeId, event) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();

  const pipe = state.pipes.find((item) => item.id === pipeId);
  if (!pipe) {
    return;
  }

  if (state.eraseMode) {
    state.pipes = state.pipes.filter((item) => item.id !== pipeId);
    state.pipeTypeUsage[pipe.type]--;
    if (state.selectedPipeId === pipeId) {
      state.selectedPipeId = null;
    }
    refreshFlowPreview();
    return;
  }

  const point = clientToStage(event.clientX, event.clientY);
  state.selectedPipeId = pipeId;

  state.drag.active = true;
  state.drag.pointerId = event.pointerId;
  state.drag.pipeId = pipeId;
  state.drag.fromToolbox = false;
  state.drag.offsetX = point.x - pipe.x;
  state.drag.offsetY = point.y - pipe.y;

  logDebug("drag-start-pipe", {
    pipeId,
    pointer: { x: event.clientX, y: event.clientY },
    stage: point,
    pipe: { x: pipe.x, y: pipe.y, rotation: pipe.rotation },
  });

  renderAll();
}

function handlePointerMove(event) {
  if (!state.drag.active || event.pointerId !== state.drag.pointerId) {
    return;
  }

  const pipe = state.pipes.find((item) => item.id === state.drag.pipeId);
  if (!pipe) {
    return;
  }

  const point = clientToStage(event.clientX, event.clientY);
  pipe.x = clamp(point.x - state.drag.offsetX, 30, STAGE_WIDTH - 30);
  pipe.y = clamp(point.y - state.drag.offsetY, 30, STAGE_HEIGHT - 30);
  snapPipe(pipe);
  logDebug("drag-move", {
    pipeId: pipe.id,
    pointer: { x: event.clientX, y: event.clientY },
    stage: point,
    snappedPipe: { x: pipe.x, y: pipe.y },
  });
  refreshFlowPreview();
}

function handlePointerUp(event) {
  if (!state.drag.active || event.pointerId !== state.drag.pointerId) {
    return;
  }

  const pipe = state.pipes.find((item) => item.id === state.drag.pipeId);
  if (pipe) {
    // Check if pipe overlaps a wall - if so, reject the placement
    if (pipeOverlapsWall(pipe)) {
      // Remove the pipe (reject placement)
      state.pipes = state.pipes.filter((item) => item.id !== pipe.id);
      state.pipeTypeUsage[pipe.type]--;
      if (state.selectedPipeId === pipe.id) {
        state.selectedPipeId = null;
      }
    } else if (pipeConnectsToSource(pipe) && countPipesConnectingToSource() > 1) {
      // Only one pipe can connect to the source
      state.pipes = state.pipes.filter((item) => item.id !== pipe.id);
      state.pipeTypeUsage[pipe.type]--;
      if (state.selectedPipeId === pipe.id) {
        state.selectedPipeId = null;
      }
      logDebug("source-exclusive", { message: "Cannot place multiple pipes on source" });
    } else {
      snapPipe(pipe);
      logDebug("drag-drop", {
        pipeId: pipe.id,
        pointer: { x: event.clientX, y: event.clientY },
        finalPipe: { x: pipe.x, y: pipe.y, rotation: pipe.rotation },
        ports: getPipePorts(pipe).map((port) => ({ id: port.id, x: port.point.x, y: port.point.y })),
      });
    }
  }

  state.drag.active = false;
  state.drag.pointerId = null;
  state.drag.pipeId = null;
  state.drag.fromToolbox = false;
  refreshFlowPreview();
}

function buildConnectionGraph() {
  const level = getLevel();
  const nodes = new Map();
  const edges = [];

  const sourceAnchor = getSourceAnchor(level);
  nodes.set("source", {
    id: "source",
    type: "source",
    point: sourceAnchor,
  });

  level.targets.forEach((target) => {
    nodes.set(`target-${target.id}`, {
      id: `target-${target.id}`,
      type: "target",
      target,
      point: getTargetAnchor(target),
    });
  });

  state.pipes.forEach((pipe) => {
    const ports = getPipePorts(pipe);
    ports.forEach((port) => {
      nodes.set(port.id, {
        id: port.id,
        type: "pipe-port",
        pipeId: pipe.id,
        point: port.point,
      });
    });

    // Create internal edges between all port pairs
    for (let i = 0; i < ports.length; i += 1) {
      for (let j = i + 1; j < ports.length; j += 1) {
        edges.push({ a: ports[i].id, b: ports[j].id });
      }
    }
  });

  const allNodes = [...nodes.values()];
  for (let i = 0; i < allNodes.length; i += 1) {
    for (let j = i + 1; j < allNodes.length; j += 1) {
      const a = allNodes[i];
      const b = allNodes[j];
      if (a.type === "target" && b.type === "target") {
        continue;
      }
      if (a.type === "source" && b.type === "target") {
        continue;
      }
      if (a.type === "pipe-port" && b.type === "pipe-port" && a.pipeId === b.pipeId) {
        continue;
      }
      // For all combinations, check distance
      if (distance(a.point, b.point) <= CONNECT_THRESHOLD) {
        edges.push({ a: a.id, b: b.id });
      }
    }
  }

  return { nodes, edges };
}

function segmentIntersectsRect(x1, y1, x2, y2, rectX, rectY, rectWidth, rectHeight) {
  // Get rect bounds centered at (rectX, rectY)
  const left = rectX - rectWidth / 2;
  const right = rectX + rectWidth / 2;
  const top = rectY - rectHeight / 2;
  const bottom = rectY + rectHeight / 2;

  // Check if either endpoint is inside the rect
  if (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) return true;
  if (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom) return true;

  // Find closest point on segment to rect center
  let closestX = x1;
  let closestY = y1;

  if (x1 !== x2 || y1 !== y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((rectX - x1) * dx + (rectY - y1) * dy) / (dx * dx + dy * dy)));
    closestX = x1 + t * dx;
    closestY = y1 + t * dy;
  }

  // Check if closest point is inside rect
  return closestX >= left && closestX <= right && closestY >= top && closestY <= bottom;
}

function pipeOverlapsTargetHitbox(pipe, target) {
  const def = PIPE_TYPES[pipe.type];
  
  // Check each segment of the pipe
  for (const segment of def.segments) {
    const p1 = localToWorld(pipe, { x: segment[0], y: segment[1] });
    const p2 = localToWorld(pipe, { x: segment[2], y: segment[3] });
    
    if (segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, target.x, target.y, CARD_HITBOX_WIDTH, CARD_HITBOX_HEIGHT)) {
      return true;
    }
  }
  
  return false;
}

function pipeOverlapsWall(pipe) {
  const level = getLevel();
  if (!level.walls) {
    return false;
  }

  const def = PIPE_TYPES[pipe.type];
  const wallThickness = 12; // Half-width for wall collision
  
  // Check each segment of the pipe against each wall
  for (const segment of def.segments) {
    const p1 = localToWorld(pipe, { x: segment[0], y: segment[1] });
    const p2 = localToWorld(pipe, { x: segment[2], y: segment[3] });
    
    for (const wall of level.walls) {
      // Check each segment of the wall path
      for (let i = 0; i < wall.path.length - 1; i++) {
        const wallStart = wall.path[i];
        const wallEnd = wall.path[i + 1];
        
        // Check if pipe segment intersects with this wall segment
        // Wall segments are axis-aligned, so we check distance from pipe segment to the wall line
        if (lineSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, wallStart.x, wallStart.y, wallEnd.x, wallEnd.y, wallThickness)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

function lineSegmentsIntersect(x1, y1, x2, y2, wx1, wy1, wx2, wy2, threshold) {
  // Check if line segment (x1,y1)-(x2,y2) intersects with wall segment (wx1,wy1)-(wx2,wy2) with given threshold
  // Wall segments are axis-aligned (horizontal or vertical)
  
  // Find closest point on wall segment to pipe segment
  const wallDx = wx2 - wx1;
  const wallDy = wy2 - wy1;
  
  // Parametric form of pipe segment: p = (x1,y1) + t*(x2-x1, y2-y1)
  const pipeDx = x2 - x1;
  const pipeDy = y2 - y1;
  
  // Check multiple points along the pipe segment for proximity to wall
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const px = x1 + t * pipeDx;
    const py = y1 + t * pipeDy;
    
    // Find closest point on wall segment
    let closestX = wx1;
    let closestY = wy1;
    
    if (Math.abs(wallDx) > Math.abs(wallDy)) {
      // Horizontal wall
      closestX = Math.max(Math.min(px, Math.max(wx1, wx2)), Math.min(wx1, wx2));
      closestY = wy1;
    } else {
      // Vertical wall
      closestX = wx1;
      closestY = Math.max(Math.min(py, Math.max(wy1, wy2)), Math.min(wy1, wy2));
    }
    
    const dist = Math.hypot(px - closestX, py - closestY);
    if (dist <= threshold) {
      return true;
    }
  }
  
  return false;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  // Distance from point to line segment
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  
  return Math.hypot(px - closestX, py - closestY);
}

function pipeConnectsToSource(pipe) {
  // Check if pipe has a port that would connect to the source
  const sourceAnchor = getSourceAnchor(getLevel());
  const ports = getPipePorts(pipe);
  
  for (const port of ports) {
    if (distance(port.point, sourceAnchor) <= CONNECT_THRESHOLD) {
      return true;
    }
  }
  
  return false;
}

function countPipesConnectingToSource() {
  // Count how many pipes are connected to the source
  let count = 0;
  for (const pipe of state.pipes) {
    if (pipeConnectsToSource(pipe)) {
      count++;
    }
  }
  return count;
}

function pipePortIsExclusive(pipe, portIndex, edges, nodes) {
  // Check if a specific port on a pipe is exclusive (connected only to elements, not other pipes)
  const portId = `p${pipe.id}-${portIndex}`;
  
  // Count how many edges connect to this port
  let edgeCount = 0;
  for (const edge of edges) {
    if (edge.a === portId || edge.b === portId) {
      // Check if the other node is a pipe-port (internal connection) vs external
      const otherNodeId = edge.a === portId ? edge.b : edge.a;
      const otherNode = nodes.get(otherNodeId);
      
      // If the other node is another pipe's port, this is not exclusive
      if (otherNode && otherNode.type === "pipe-port" && otherNode.pipeId !== pipe.id) {
        return false;
      }
      edgeCount++;
    }
  }
  
  // Port is exclusive if it has at least one external connection and no pipe-to-pipe connections
  return edgeCount > 0;
}

function validateWallsNotInElementHitboxes() {
  const level = getLevel();
  if (!level.walls) {
    return true;
  }

  const elementBuffer = 50; // Minimum distance walls should maintain from hitboxes
  
  // Check walls against source
  const sourceAnchor = getSourceAnchor(level);
  for (const wall of level.walls) {
    for (let i = 0; i < wall.path.length - 1; i++) {
      const start = wall.path[i];
      const end = wall.path[i + 1];
      const dist = pointToSegmentDistance(sourceAnchor.x, sourceAnchor.y, start.x, start.y, end.x, end.y);
      if (dist < elementBuffer) {
        logDebug("wall-collision", { element: "source", distance: dist, required: elementBuffer });
        return false;
      }
    }
  }
  
  // Check walls against targets (cups and bucket)
  for (const wall of level.walls) {
    for (let i = 0; i < wall.path.length - 1; i++) {
      const start = wall.path[i];
      const end = wall.path[i + 1];
      
      for (const target of level.targets) {
        const targetAnchor = getTargetAnchor(target);
        const dist = pointToSegmentDistance(targetAnchor.x, targetAnchor.y, start.x, start.y, end.x, end.y);
        if (dist < elementBuffer) {
          logDebug("wall-collision", { element: target.id, distance: dist, required: elementBuffer });
          return false;
        }
      }
    }
  }
  
  return true;
}

function evaluateFlow() {
  const level = getLevel();
  const { nodes, edges } = buildConnectionGraph();
  const adjacency = new Map();

  nodes.forEach((_, id) => {
    adjacency.set(id, []);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
  });

  const queue = ["source"];
  const visited = new Set(["source"]);
  const parents = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) || [];
    neighbors.forEach((neighbor) => {
      if (visited.has(neighbor)) {
        return;
      }
      visited.add(neighbor);
      parents.set(neighbor, current);
      queue.push(neighbor);
    });
  }

  const fills = new Map();
  const reachedPipeIds = new Set();
  let score = 0;

  visited.forEach((nodeId) => {
    const node = nodes.get(nodeId);
    if (node?.type === "pipe-port") {
      reachedPipeIds.add(node.pipeId);
    }
  });

  // Check each target for fill by checking if any watered pipe overlaps its hitbox
  level.targets.forEach((target) => {
    let hitboxOverlapped = false;
    
    // Check if any watered (connected to source) pipe overlaps with the target hitbox
    state.pipes.forEach((pipe) => {
      if (reachedPipeIds.has(pipe.id)) {
        if (pipeOverlapsTargetHitbox(pipe, target)) {
          // Check if the pipe port hitting the cup is exclusive (not connected to other pipes)
          const def = PIPE_TYPES[pipe.type];
          for (let i = 0; i < def.segments.length; i++) {
            // Find which port(s) are at or near the target
            const pipePorts = getPipePorts(pipe);
            for (let portIdx = 0; portIdx < pipePorts.length; portIdx++) {
              const port = pipePorts[portIdx];
              if (distance(port.point, target) <= CONNECT_THRESHOLD) {
                // Check if this port is exclusive
                if (pipePortIsExclusive(pipe, portIdx, edges, nodes)) {
                  hitboxOverlapped = true;
                  logDebug("hitbox-hit", { targetId: target.id, pipeId: pipe.id, pipePos: `(${pipe.x}, ${pipe.y})`, targetPos: `(${target.x}, ${target.y})`, exclusive: true });
                  break;
                }
              }
            }
            if (hitboxOverlapped) break;
          }
        }
      }
    });
    
    const fill = hitboxOverlapped ? 100 : 0;
    fills.set(target.id, fill);
    if (fill > 0) {
      score += target.kind === "bucket" ? 4 : 3;
    }
  });

  const connectorEdges = [];
  edges.forEach((edge) => {
    const a = nodes.get(edge.a);
    const b = nodes.get(edge.b);
    if (!a || !b) {
      return;
    }
    if (a.type === "pipe-port" && b.type === "pipe-port" && a.pipeId === b.pipeId) {
      return;
    }
    connectorEdges.push({ a: a.point, b: b.point });
  });

  const flowEdges = [];
  visited.forEach((nodeId) => {
    const parent = parents.get(nodeId);
    if (!parent) {
      return;
    }
    const a = nodes.get(nodeId);
    const b = nodes.get(parent);
    if (!a || !b) {
      return;
    }
    flowEdges.push({ a: a.point, b: b.point });
  });

  return { fills, score, reachedPipeIds, connectorEdges, flowEdges };
}

function autoOrientPipes() {
  const { nodes, edges } = buildConnectionGraph();
  const nodeMap = new Map();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  state.pipes.forEach((pipe) => {
    if (!state.results.reachedPipeIds.has(pipe.id)) {
      return;
    }

    const def = PIPE_TYPES[pipe.type];
    const pipeNodeIds = new Set(
      def.ports.map((_, i) => `p${pipe.id}-${i}`)
    );

    // Collect which direction each connected port comes from in world space
    const connectedPortIndices = [];
    edges.forEach((edge) => {
      const isPortA = pipeNodeIds.has(edge.a);
      const isPortB = pipeNodeIds.has(edge.b);
      
      if (isPortA || isPortB) {
        const portId = isPortA ? edge.a : edge.b;
        const otherNodeId = isPortA ? edge.b : edge.a;
        const portIndex = parseInt(portId.split("-")[1]);
        const otherNode = nodeMap.get(otherNodeId);
        
        if (portIndex >= 0 && portIndex < def.ports.length && otherNode) {
          connectedPortIndices.push({
            portIndex,
            worldPos: otherNode.point,
          });
        }
      }
    });

    if (connectedPortIndices.length < 2) {
      return;
    }

    // Try each rotation and see which one aligns ports to their connections
    let bestRotation = pipe.rotation;
    let bestScore = -1;

    for (let testRotation = 0; testRotation < 360; testRotation += 90) {
      let score = 0;
      
      connectedPortIndices.forEach(({ portIndex, worldPos }) => {
        // Get the world position of this port at this rotation
        const localPort = def.ports[portIndex];
        const worldPort = {
          x: pipe.x,
          y: pipe.y,
        };
        
        const angle = toRadians(testRotation);
        const scale = PIPE_SIZE / 2;
        const x = localPort.x * scale;
        const y = localPort.y * scale;
        
        worldPort.x += x * Math.cos(angle) - y * Math.sin(angle);
        worldPort.y += x * Math.sin(angle) + y * Math.cos(angle);
        
        // Check distance between port and connection point
        const d = distance(worldPort, worldPos);
        score += 1 / (1 + d); // Higher score for closer alignments
      });

      // Prefer current rotation if scores are equal (stability)
      const scoreDiff = Math.abs(score - bestScore);
      if (score > bestScore + 0.0001 || (scoreDiff <= 0.0001 && testRotation === pipe.rotation)) {
        bestScore = score;
        bestRotation = testRotation;
      }
    }

    pipe.rotation = bestRotation;
  });
}

function refreshFlowPreview() {
  state.results = evaluateFlow();
  autoOrientPipes();
  logDebug("flow-preview", {
    score: state.results.score,
    fills: Object.fromEntries(state.results.fills.entries()),
    connectors: state.results.connectorEdges.length,
    flowLines: state.results.flowEdges.length,
    wateredPipes: state.results.reachedPipeIds.size,
  });
  renderAll();
}

function showModal({ title, message, actions }) {
  refs.modalTitle.textContent = title;
  refs.modalMessage.textContent = message;
  refs.modalActions.innerHTML = "";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.className = `button-link ${action.style === "primary" ? "primary-button" : "secondary-button"}`;
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      refs.modal.classList.remove("is-open");
      refs.modal.setAttribute("aria-hidden", "true");
      action.onClick();
    });
    refs.modalActions.appendChild(button);
  });

  refs.modal.classList.add("is-open");
  refs.modal.setAttribute("aria-hidden", "false");
}

function restartGame() {
  state.currentLevelIndex = 0;
  loadLevel();
}

function runWater() {
  const level = getLevel();
  let result = evaluateFlow();
  
  // Apply pipe usage penalty for Level 2
  if (level.pipeUsagePenalty) {
    const totalPipes = Object.values(state.pipeTypeUsage).reduce((a, b) => a + b, 0);
    const penalty = Math.floor(totalPipes / 5);
    result.score -= penalty;
    if (result.score < 0) result.score = 0;
  }
  
  state.results = result;
  renderAll();

  // Determine winning conditions
  const bucketFilled = (result.fills.get("bucket") || 0) > 0;
  const meetsMinScore = result.score >= level.minScore;
  const requiredBucketFilled = !level.requireBucket || bucketFilled;
  const allTargetsFilled = level.targets.every((target) => (result.fills.get(target.id) || 0) > 0);

  if (allTargetsFilled && meetsMinScore && requiredBucketFilled) {
    const isLast = state.currentLevelIndex === LEVELS.length - 1;
    if (isLast) {
      showModal({
        title: "You Win!",
        message: `You completed all levels with ${result.score} points in the final stage.`,
        actions: [
          { label: "Restart Game", style: "primary", onClick: restartGame },
          { label: "Share", style: "secondary", onClick: shareResult },
        ],
      });
      return;
    }

    showModal({
      title: "Level Complete",
      message: `Great routing. Score: ${result.score}. Ready for the next level.`,
      actions: [
        {
          label: "Next Level",
          style: "primary",
          onClick: () => {
            state.currentLevelIndex += 1;
            loadLevel();
          },
        },
        { label: "Restart Game", style: "secondary", onClick: restartGame },
        { label: "Share", style: "secondary", onClick: shareResult },
      ],
    });
    return;
  }

  const winCondition = level.requireBucket ? `all targets filled, bucket filled, and at least ${level.minScore} points` : `all targets filled and at least ${level.minScore} points`;
  const actualBucketStatus = bucketFilled ? "" : " (Bucket not filled)";
  
  showModal({
    title: "Try Again",
    message: `You need ${winCondition}. Current score: ${result.score}.${actualBucketStatus}`,
    actions: [
      { label: "Retry Level", style: "primary", onClick: loadLevel },
      { label: "Restart Game", style: "secondary", onClick: restartGame },
      { label: "Share", style: "secondary", onClick: shareResult },
    ],
  });
}

async function shareResult() {
  const text = `I am playing Aqua Maze and scored ${state.results.score} on ${getLevel().name}.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Aqua Maze", text });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      window.alert("Score summary copied to clipboard.");
      return;
    }
  } catch (error) {
    console.error(error);
  }
  window.alert(text);
}

function removeSelectedPipe() {
  if (!state.selectedPipeId) {
    return;
  }
  state.pipes = state.pipes.filter((pipe) => pipe.id !== state.selectedPipeId);
  state.selectedPipeId = null;
  refreshFlowPreview();
}

function rotateSelectedPipe() {
  if (state.selectedPipeId) {
    const selected = state.pipes.find((pipe) => pipe.id === state.selectedPipeId);
    if (selected) {
      selected.rotation = (selected.rotation + 90) % 360;
      refreshFlowPreview();
      return;
    }
  }

  state.selectedRotation = (state.selectedRotation + 90) % 360;
  updateRotateButtonLabel();
  renderPipeOptions();
}

function showLevelIntroPopup() {
  const level = getLevel();
  const levelNum = state.currentLevelIndex + 1;
  
  let title = "";
  let message = "";
  
  if (levelNum === 2) {
    title = "Efficiency Matters";
    message = "On this mission, efficiency is critical. For every 5 pipes you place, you lose 1 impact point. This reflects the real-world challenge of building sustainable water infrastructure with limited resources.\n\nPlan your routes strategically to maximize your score.";
  } else if (levelNum === 3) {
    title = "Resource Constraints";
    message = "This advanced mission has limited resources. You can place a maximum of 8 pipes of each type.\n\nThis constraint mirrors real-world challenges in scaling water access globally. Every pipe must serve its purpose efficiently.";
  }
  
  if (title) {
    refs.modalTitle.textContent = title;
    refs.modalMessage.textContent = message;
    refs.modalActions.innerHTML = "<button class='button-link primary-button' id='popupOkBtn' type='button'>Begin Mission</button>";
    refs.modal.classList.add("is-open");
    refs.modal.setAttribute("aria-hidden", "false");
    
    document.getElementById("popupOkBtn").addEventListener("click", () => {
      refs.modal.classList.remove("is-open");
      refs.modal.setAttribute("aria-hidden", "true");
    });
  }
}

function loadLevel() {
  const level = getLevel();
  
  // Validate walls don't enter element hitboxes
  if (!validateWallsNotInElementHitboxes()) {
    console.warn(`[AquaMaze] Level ${state.currentLevelIndex + 1}: Walls are too close to game elements`);
  }
  
  state.pipes = [];
  state.selectedPipeId = null;
  state.showPreview = false;
  state.showGrid = false;
  state.hasShownLevelPopup = false;
  state.pipeTypeUsage = {
    straight: 0,
    elbow: 0,
    tee: 0,
    cross: 0,
  };
  state.drag.active = false;
  state.drag.pointerId = null;
  state.drag.pipeId = null;
  state.drag.fromToolbox = false;
  state.drag.offsetX = 0;
  state.drag.offsetY = 0;

  refs.levelName.textContent = level.name;
  refs.levelRules.textContent = `Minimum score: ${level.minScore} ${level.requireBucket ? "+ Bucket" : ""}`;
  refs.toggleGridButton.textContent = state.showGrid ? "Hide Grid" : "Show Grid";
  refs.modal.classList.remove("is-open");
  refs.modal.setAttribute("aria-hidden", "true");

  refreshFlowPreview();
  
  // Show level intro popup
  showLevelIntroPopup();
}

function showHelpModal() {
  const level = getLevel();
  const levelNum = state.currentLevelIndex + 1;
  
  let contentHTML = `
    <div class="help-section">
      <div class="help-section-title">Game Objective</div>
      <p class="help-section-text">Build pipe routes from the water source to fill all cups and the storage tank.</p>
    </div>
    
    <div class="help-section">
      <div class="help-section-title">How to Play</div>
      <ul class="help-rules-list">
        <li>Drag pipes from the toolbox onto the grid</li>
        <li>Click pipes to select and rotate them using the rotate button</li>
        <li>Connect water source to all cups and the storage tank</li>
        <li>Use eraser button to remove pipes</li>
        <li>Click "Run Water" to test your solution</li>
      </ul>
    </div>
    
    <div class="help-section">
      <div class="help-section-title">Winning Condition</div>
      <ul class="help-rules-list">
        <li>Recieve minimum points for level AND fill the storage tank</li>
        <li>Complete the level challenge conditions to win</li>
  `;
  
  if (level.pipeUsagePenalty) {
    contentHTML += `
        <li style="margin-top: 8px;"><strong>Level 2 Challenge:</strong> Using more pipes reduces your score</li>
        <li>Deduction: 1 point for every 5 pipes used</li>
    `;
  }
  
  if (level.pipeLimit) {
    contentHTML += `
        <li style="margin-top: 8px;"><strong>Level 3 Challenge:</strong> Limited resources available</li>
        <li>You can only use 8 pipes of each type</li>
    `;
  }
  
  contentHTML += `
      </ul>
    </div>
  `;
  
  if (level.walls) {
    contentHTML += `
    <div class="help-section">
      <div class="help-section-title">Obstacles</div>
      <p class="help-section-text">Dark lines on the board are walls. Route your pipes around them—they block water flow.</p>
    </div>
    `;
  }
  
  refs.helpModalContent.innerHTML = contentHTML;
  refs.helpModalActions.innerHTML = `<button class='button-link primary-button' id='closeHelpBtn' type='button'>Got it!</button>`;
  refs.helpModal.classList.add("is-open");
  refs.helpModal.setAttribute("aria-hidden", "false");
  
  document.getElementById("closeHelpBtn").addEventListener("click", () => {
    refs.helpModal.classList.remove("is-open");
    refs.helpModal.setAttribute("aria-hidden", "true");
  });
}

function initEvents() {
  refs.runWaterButton.addEventListener("click", runWater);
  refs.resetLevelButton.addEventListener("click", loadLevel);
  refs.restartGameButton.addEventListener("click", restartGame);
  refs.helpButton.addEventListener("click", showHelpModal);

  refs.rotatePieceButton.addEventListener("click", rotateSelectedPipe);

  refs.eraseModeButton.addEventListener("click", () => {
    state.eraseMode = !state.eraseMode;
    refs.eraseModeButton.classList.toggle("is-erase-mode", state.eraseMode);
    if (state.eraseMode && state.selectedPipeId) {
      removeSelectedPipe();
    }
  });

  refs.toggleGridButton.addEventListener("click", () => {
    state.showGrid = !state.showGrid;
    refs.toggleGridButton.textContent = state.showGrid ? "Hide Grid" : "Show Grid";
    renderGrid();
  });

  refs.modal.addEventListener("click", (event) => {
    if (event.target === refs.modal) {
      refs.modal.classList.remove("is-open");
      refs.modal.setAttribute("aria-hidden", "true");
    }
  });

  refs.helpModal.addEventListener("click", (event) => {
    if (event.target === refs.helpModal) {
      refs.helpModal.classList.remove("is-open");
      refs.helpModal.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", handlePointerUp);

  refs.stage.addEventListener("click", (event) => {
    if (event.target === refs.stage || event.target === refs.pipeLayer) {
      state.selectedPipeId = null;
      renderPipeLayer();
    }
  });
}

function initGame() {
  updateRotateButtonLabel();
  renderPipeOptions();
  refs.toggleGridButton.textContent = state.showGrid ? "Hide Grid" : "Show Grid";
  initEvents();
  loadLevel();
}

initGame();
