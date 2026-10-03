(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const COLORS = [null, "#28d9f5", "#376cff", "#ff9142", "#ffd241", "#39de8d", "#a552f4", "#ff4f67"];
  const PIECES = {
    I: [[1, 1, 1, 1]],
    J: [[2, 0, 0], [2, 2, 2]],
    L: [[0, 0, 3], [3, 3, 3]],
    O: [[4, 4], [4, 4]],
    S: [[0, 5, 5], [5, 5, 0]],
    T: [[0, 6, 0], [6, 6, 6]],
    Z: [[7, 7, 0], [0, 7, 7]]
  };
  const TYPES = Object.keys(PIECES);

  const gameCanvas = document.querySelector("#game");
  const nextCanvas = document.querySelector("#next");
  const ctx = gameCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"),
    lines: document.querySelector("#lines"),
    level: document.querySelector("#level"),
    overlay: document.querySelector("#overlay"),
    overlayKicker: document.querySelector("#overlayKicker"),
    overlayTitle: document.querySelector("#overlayTitle"),
    overlayButton: document.querySelector("#overlayButton"),
    start: document.querySelector("#startButton"),
    pause: document.querySelector("#pauseButton")
  };

  let board = createBoard();
  let bag = [];
  let active = null;
  let nextType = randomType();
  let score = 0;
  let lines = 0;
  let level = 1;
  let running = false;
  let paused = false;
  let gameOver = false;
  let dropCounter = 0;
  let lastTime = 0;
  let animationId = null;

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function cloneMatrix(matrix) {
    return matrix.map(row => [...row]);
  }

  function randomType() {
    if (bag.length === 0) {
      bag = [...TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function spawnPiece() {
    active = {
      matrix: cloneMatrix(PIECES[nextType]),
      x: 0,
      y: 0
    };
    nextType = randomType();
    active.x = Math.floor((COLS - active.matrix[0].length) / 2);
    if (collides(active)) endGame();
    drawNext();
  }

  function collides(piece) {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const boardX = piece.x + x;
        const boardY = piece.y + y;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  function merge() {
    active.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && active.y + y >= 0) board[active.y + y][active.x + x] = value;
      });
    });
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      updateStats();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawnPiece();
  }

  function move(direction) {
    if (!canControl()) return;
    active.x += direction;
    if (collides(active)) active.x -= direction;
    draw();
  }

  function softDrop(manual = false) {
    if (!canControl()) return;
    active.y++;
    if (collides(active)) {
      active.y--;
      lockPiece();
    } else if (manual) {
      score += 1;
      updateStats();
    }
    dropCounter = 0;
    draw();
  }

  function hardDrop() {
    if (!canControl()) return;
    let distance = 0;
    while (!collides(active)) {
      active.y++;
      distance++;
    }
    active.y--;
    distance--;
    score += Math.max(0, distance) * 2;
    updateStats();
    lockPiece();
    draw();
  }

  function rotateMatrix(matrix) {
    return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
  }

  function rotate() {
    if (!canControl()) return;
    const oldMatrix = active.matrix;
    const oldX = active.x;
    active.matrix = rotateMatrix(active.matrix);
    for (const offset of [0, -1, 1, -2, 2]) {
      active.x = oldX + offset;
      if (!collides(active)) {
        draw();
        return;
      }
    }
    active.matrix = oldMatrix;
    active.x = oldX;
  }

  function canControl() {
    return running && !paused && !gameOver && active;
  }

  function startGame(forceReset = false) {
    if (forceReset || gameOver || !active) resetState();
    running = true;
    paused = false;
    gameOver = false;
    hideOverlay();
    ui.pause.disabled = false;
    ui.start.querySelector("span").textContent = "LÄUFT";
    if (!animationId) {
      lastTime = performance.now();
      animationId = requestAnimationFrame(update);
    }
  }

  function resetState() {
    board = createBoard();
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    nextType = randomType();
    active = null;
    spawnPiece();
    updateStats();
    draw();
  }

  function restart() {
    resetState();
    startGame();
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    ui.pause.querySelector("span").textContent = paused ? "WEITER" : "PAUSE";
    ui.start.querySelector("span").textContent = paused ? "PAUSIERT" : "LÄUFT";
    if (paused) showOverlay("Kurze Pause", "Bereit zum Weiterspielen?", "WEITER");
    else hideOverlay();
  }

  function endGame() {
    running = false;
    gameOver = true;
    ui.pause.disabled = true;
    ui.start.querySelector("span").textContent = "START";
    showOverlay("Spiel beendet", `${score.toLocaleString("de-DE")} Punkte`, "NOCHMAL");
  }

  function showOverlay(kicker, title, button) {
    ui.overlayKicker.textContent = kicker;
    ui.overlayTitle.textContent = title;
    ui.overlayButton.textContent = button;
    ui.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    ui.overlay.classList.add("hidden");
  }

  function updateStats() {
    ui.score.textContent = score.toLocaleString("de-DE");
    ui.lines.textContent = lines.toLocaleString("de-DE");
    ui.level.textContent = level.toLocaleString("de-DE");
  }

  function drawCell(context, x, y, value, size = BLOCK) {
    if (!value) return;
    const color = COLORS[value];
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = size * 0.2;
    context.fillRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
    context.shadowBlur = 0;
    const shine = context.createLinearGradient(0, y * size, 0, (y + 1) * size);
    shine.addColorStop(0, "rgba(255,255,255,.34)");
    shine.addColorStop(0.35, "rgba(255,255,255,.04)");
    shine.addColorStop(1, "rgba(0,0,0,.2)");
    context.fillStyle = shine;
    context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
    context.strokeStyle = "rgba(255,255,255,.24)";
    context.lineWidth = 1;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }

  function drawGrid() {
    ctx.fillStyle = "#040b1a";
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    ctx.strokeStyle = "rgba(43, 89, 139, 0.28)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * BLOCK + 0.5, 0); ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * BLOCK + 0.5); ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5); ctx.stroke();
    }
  }

  function drawMatrix(context, matrix, offsetX, offsetY, size = BLOCK) {
    matrix.forEach((row, y) => row.forEach((value, x) => drawCell(context, offsetX + x, offsetY + y, value, size)));
  }

  function drawGhost() {
    if (!active || !running || paused) return;
    const ghost = { matrix: active.matrix, x: active.x, y: active.y };
    while (!collides(ghost)) ghost.y++;
    ghost.y--;
    ctx.save();
    ctx.globalAlpha = 0.15;
    drawMatrix(ctx, ghost.matrix, ghost.x, ghost.y);
    ctx.restore();
  }

  function draw() {
    drawGrid();
    drawMatrix(ctx, board, 0, 0);
    if (active) {
      drawGhost();
      drawMatrix(ctx, active.matrix, active.x, active.y);
    }
  }

  function drawNext() {
    const matrix = PIECES[nextType];
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = "#050d20";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const size = 24;
    const offsetX = (nextCanvas.width / size - matrix[0].length) / 2;
    const offsetY = (nextCanvas.height / size - matrix.length) / 2;
    drawMatrix(nextCtx, matrix, offsetX, offsetY, size);
  }

  function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;
    if (running && !paused && !gameOver) {
      dropCounter += delta;
      const interval = Math.max(100, 850 - (level - 1) * 70);
      if (dropCounter > interval) softDrop();
    }
    draw();
    animationId = requestAnimationFrame(update);
  }

  function handleAction(action) {
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "rotate") rotate();
    if (action === "down") softDrop(true);
    if (action === "drop") hardDrop();
  }

  document.addEventListener("keydown", event => {
    const keyMap = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "down", " ": "drop" };
    if (keyMap[event.key]) {
      event.preventDefault();
      handleAction(keyMap[event.key]);
    } else if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      event.preventDefault();
      togglePause();
    }
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      handleAction(button.dataset.action);
    });
  });

  ui.start.addEventListener("click", () => {
    if (paused) togglePause();
    else if (!running) startGame();
  });
  ui.pause.addEventListener("click", togglePause);
  ui.overlayButton.addEventListener("click", () => paused ? togglePause() : startGame(gameOver));
  document.querySelector("#restartButton").addEventListener("click", restart);
  document.querySelector("#restartTop").addEventListener("click", restart);

  window.addEventListener("blur", () => {
    if (running && !paused && !gameOver) togglePause();
  });

  resetState();
  showOverlay("Bereit?", "Starte dein Spiel", "START");
})();
