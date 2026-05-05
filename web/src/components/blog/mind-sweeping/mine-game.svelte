<script module lang="ts">
  export const CELL_SIZE = 24;
  const WINDOW_PADDING = 8;
  const TITLE_BAR_HEIGHT = 20;
  const STATUS_PANEL_HEIGHT = 52;
  const STATUS_PANEL_GAP = 8;
  const BOARD_PANEL_PADDING = 4;
  export const WIDTH_OVERHEAD = WINDOW_PADDING * 2 + BOARD_PANEL_PADDING * 2;
  export const HEIGHT_OVERHEAD =
    TITLE_BAR_HEIGHT +
    WINDOW_PADDING +
    STATUS_PANEL_HEIGHT +
    STATUS_PANEL_GAP +
    BOARD_PANEL_PADDING * 2 +
    WINDOW_PADDING;
</script>

<script lang="ts">
  import blueTangFrownImage from "./blue-tang-frown.svg";
  import blueTangSmileImage from "./blue-tang-smile.svg";
  import blueTangShadesImage from "./blue-tang-shades.svg";
  import blueTangSurpriseImage from "./blue-tang-surprise.svg";
  import buoyImage from "./buoy.svg";
  import seagullLookingImage from "./seagull-looking.svg";
  import seagullMineImage from "./seagull-mine.svg";
  import wavesImage from "./waves.svg";
  import { onDestroy, onMount } from "svelte";

  const MINE_FRACTION = 0.15625; // Computed from default Minesweeper settings for first 2 presets: 10 mines in 8x8, 40 mines in 16x16. 99 mines (30x16) is higher: 0.20625.
  const NUMBER_COLORS: Record<number, string> = {
    1: "#0000ff",
    2: "#008200",
    3: "#ff0000",
    4: "#000084",
    5: "#840000",
    6: "#008284",
    7: "#000000",
    8: "#7b7b7b",
  };

  interface Props {
    height: number;
    numMines?: number;
    width: number;
  }

  type MarkState = "none" | "buoy" | "question";
  type GameState = "ready" | "playing" | "won" | "lost";
  type Position = [number, number];

  interface Cell {
    adjacent: number;
    caught: boolean;
    id: string;
    isMine: boolean;
    mark: MarkState;
    revealed: boolean;
    wrongBuoy: boolean;
    position: Position;
  }

  let { height = 9, numMines, width = 9 }: Props = $props();

  let cols = $state(0);
  let rows = $state(0);
  let mines = $state(0);
  let board = $state<Cell[][]>([]);
  let elapsedSeconds = $state(0);
  let buoyCount = $state(0);
  let gameState = $state<GameState>("ready");
  let minesPlaced = $state(false);
  let pressedCellId = $state<string | null>(null);
  let isMouseDownOnBoard = $state(false);

  let timerId: ReturnType<typeof setInterval> | null = null;

  const mineDisplay = $derived(formatCounter(Math.max(-99, Math.min(999, mines - buoyCount))));
  const timeDisplay = $derived(formatCounter(Math.min(999, elapsedSeconds)));
  const resetButtonImage = $derived.by(() => {
    if (gameState === "won") {
      return blueTangShadesImage;
    }
    if (gameState === "lost") {
      return blueTangFrownImage;
    }
    return isMouseDownOnBoard ? blueTangSurpriseImage : blueTangSmileImage;
  });
  const COUNTER_WIDTH = 62;
  const COUNTER_HEIGHT = 34;
  const RESET_SIZE = 34;
  const BOARD_PANEL_X = WINDOW_PADDING;
  const STATUS_PANEL_Y = TITLE_BAR_HEIGHT + WINDOW_PADDING;
  const BOARD_PANEL_Y = STATUS_PANEL_Y + STATUS_PANEL_HEIGHT + STATUS_PANEL_GAP;

  const boardPixelWidth = $derived(cols * CELL_SIZE);
  const boardPixelHeight = $derived(rows * CELL_SIZE);
  const boardPanelWidth = $derived(boardPixelWidth + BOARD_PANEL_PADDING * 2);
  const boardPanelHeight = $derived(boardPixelHeight + BOARD_PANEL_PADDING * 2);
  const viewportWidth = $derived(boardPanelWidth + WINDOW_PADDING * 2);
  const viewportHeight = $derived(BOARD_PANEL_Y + boardPanelHeight + WINDOW_PADDING);
  const resetButtonX = $derived(BOARD_PANEL_X + (boardPanelWidth - RESET_SIZE) / 2);
  const rightCounterX = $derived(BOARD_PANEL_X + boardPanelWidth - COUNTER_WIDTH - 6);
  const ICON_PADDING = 2;
  const ICON_SIZE = CELL_SIZE - ICON_PADDING * 2;

  const beveledPanels = $derived([
    {
      id: "status",
      x: BOARD_PANEL_X,
      y: STATUS_PANEL_Y,
      width: boardPanelWidth,
      height: STATUS_PANEL_HEIGHT,
      fill: "#bdbdbd",
    },
    {
      id: "board",
      x: BOARD_PANEL_X,
      y: BOARD_PANEL_Y,
      width: boardPanelWidth,
      height: boardPanelHeight,
      fill: "#bdbdbd",
    },
  ]);

  const counterPanels = $derived([
    {
      id: "mines",
      label: "Mines remaining",
      x: BOARD_PANEL_X + 6,
      y: STATUS_PANEL_Y + 9,
      value: mineDisplay,
    },
    {
      id: "time",
      label: "Elapsed time",
      x: rightCounterX,
      y: STATUS_PANEL_Y + 9,
      value: timeDisplay,
    },
  ]);

  $effect(() => {
    cols = Math.max(9, width);
    rows = Math.max(9, height);
    mines = Math.min(
      Math.max(numMines ?? Math.floor(width * height * MINE_FRACTION), 1),
      width * height - 1,
    );
    resetGame();
  });

  onMount(() => {
    const handleMouseUp = () => {
      clearPressState();
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  onDestroy(() => {
    stopTimer();
  });

  function resetBoard() {
    board = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) => ({
        adjacent: 0,
        caught: false,
        id: `${x}-${y}`,
        isMine: false,
        mark: "none",
        revealed: false,
        wrongBuoy: false,
        position: [x, y],
      })),
    );
  }

  function formatCounter(v: number): string {
    return v < 0 ? `-${Math.abs(v).toString().padStart(2, "0")}` : v.toString().padStart(3, "0");
  }

  function getAdjacentPositions(p: Position): Array<Position> {
    return [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]
      .map<Position>(([dx, dy]) => [p[0] + dx, p[1] + dy])
      .filter(([ax, ay]) => ax >= 0 && ax < cols && ay >= 0 && ay < rows);
  }

  function computeAdjacencyCounts(): void {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = board[y][x];
        if (cell.isMine) {
          cell.adjacent = 0;
          continue;
        }

        let total = 0;
        for (const [nx, ny] of getAdjacentPositions([x, y])) {
          if (board[ny][nx].isMine) {
            total += 1;
          }
        }
        cell.adjacent = total;
      }
    }
  }

  function shuffleCoords(coords: Array<Position>): void {
    for (let i = coords.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }
  }

  function placeMines(safePosition: Position): void {
    const candidates: Array<Position> = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const inSafeZone = Math.abs(x - safePosition[0]) <= 1 && Math.abs(y - safePosition[1]) <= 1;
        if (!inSafeZone) {
          candidates.push([x, y]);
        }
      }
    }

    if (candidates.length < mines) {
      candidates.length = 0;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (x !== safePosition[0] || y !== safePosition[1]) {
            candidates.push([x, y]);
          }
        }
      }
    }

    shuffleCoords(candidates);

    for (let i = 0; i < mines; i += 1) {
      const [x, y] = candidates[i];
      board[y][x].isMine = true;
    }

    computeAdjacencyCounts();
    minesPlaced = true;
  }

  function startTimer(): void {
    if (timerId !== null) {
      return;
    }

    timerId = setInterval(() => {
      if (gameState === "playing") {
        elapsedSeconds = Math.min(999, elapsedSeconds + 1);
      }
    }, 1000);
  }

  function stopTimer(): void {
    if (timerId === null) {
      return;
    }

    clearInterval(timerId);
    timerId = null;
  }

  function resetGame(): void {
    stopTimer();
    resetBoard();
    elapsedSeconds = 0;
    buoyCount = 0;
    gameState = "ready";
    minesPlaced = false;
    pressedCellId = null;
    isMouseDownOnBoard = false;
  }

  function clearPressState(): void {
    pressedCellId = null;
    isMouseDownOnBoard = false;
  }

  function revealFlood(startPosition: Position): void {
    const queue: Array<Position> = [startPosition];

    while (queue.length > 0) {
      const pos = queue.shift() as Position;
      const cell = board[pos[1]][pos[0]];

      if (cell.revealed || cell.mark === "buoy" || cell.isMine) {
        continue;
      }

      cell.revealed = true;

      if (cell.adjacent === 0) {
        for (const [nx, ny] of getAdjacentPositions(pos)) {
          const neighbor = board[ny][nx];
          if (!neighbor.revealed && neighbor.mark !== "buoy") {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  function revealMinesAfterLoss(): void {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = board[y][x];

        if (cell.isMine && cell.mark !== "buoy") {
          cell.revealed = true;
        }

        if (!cell.isMine && cell.mark === "buoy") {
          cell.wrongBuoy = true;
          cell.revealed = true;
        }
      }
    }
  }

  function loseGame(position: Position): void {
    const cell = board[position[1]][position[0]];
    cell.caught = true;
    cell.revealed = true;

    gameState = "lost";
    stopTimer();
    revealMinesAfterLoss();
    clearPressState();
  }

  function markAllMinesOnWin(): void {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = board[y][x];
        if (cell.isMine) {
          cell.mark = "buoy";
        }
      }
    }

    buoyCount = mines;
  }

  function checkWin(): void {
    if (gameState === "lost") {
      return;
    }

    let safeCellsLeft = 0;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const cell = board[y][x];
        if (!cell.isMine && !cell.revealed) {
          safeCellsLeft += 1;
        }
      }
    }

    if (safeCellsLeft === 0) {
      gameState = "won";
      stopTimer();
      markAllMinesOnWin();
      clearPressState();
    }
  }

  function chordCell(position: Position): void {
    if (gameState === "won" || gameState === "lost") {
      return;
    }

    const cell = board[position[1]][position[0]];
    if (!cell.revealed || cell.adjacent === 0) {
      return;
    }

    const neighbors = getAdjacentPositions(position);
    let markedNeighbors = 0;

    for (const adjPos of neighbors) {
      if (board[adjPos[1]][adjPos[0]].mark === "buoy") {
        markedNeighbors += 1;
      }
    }

    if (markedNeighbors !== cell.adjacent) {
      return;
    }

    for (const adjPos of neighbors) {
      const neighbor = board[adjPos[1]][adjPos[0]];
      if (neighbor.revealed || neighbor.mark === "buoy") {
        continue;
      }

      if (neighbor.isMine) {
        loseGame(adjPos);
        return;
      }

      revealFlood(adjPos);
    }

    checkWin();
  }

  function revealCell(position: Position): void {
    if (gameState === "won" || gameState === "lost") {
      return;
    }

    const cell = board[position[1]][position[0]];

    if (cell.revealed) {
      chordCell(position);
      return;
    }

    if (cell.mark === "buoy") {
      return;
    }

    if (!minesPlaced) {
      placeMines(position);
      gameState = "playing";
      startTimer();
    }

    if (cell.isMine) {
      loseGame(position);
      return;
    }

    revealFlood(position);
    checkWin();
  }

  function cycleMark(position: Position): void {
    if (gameState === "won" || gameState === "lost") {
      return;
    }

    const cell = board[position[1]][position[0]];

    if (cell.revealed) {
      return;
    }

    if (cell.mark === "none") {
      cell.mark = "buoy";
      buoyCount += 1;
      return;
    }

    if (cell.mark === "buoy") {
      cell.mark = "question";
      buoyCount -= 1;
      return;
    }

    cell.mark = "none";
  }

  function handleCellMouseDown(event: MouseEvent, position: Position): void {
    if (event.button !== 0 || gameState === "won" || gameState === "lost") {
      return;
    }

    const cell = board[position[1]][position[0]];
    isMouseDownOnBoard = true;

    if (!cell.revealed && cell.mark !== "buoy") {
      pressedCellId = cell.id;
    }
  }

  function handleCellClick(position: Position): void {
    revealCell(position);
    clearPressState();
  }

  function handleCellRightClick(event: MouseEvent, position: Position): void {
    event.preventDefault();
    cycleMark(position);
    clearPressState();
  }

  function handleCellKeydown(event: KeyboardEvent, position: Position): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCellClick(position);
      return;
    }

    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      cycleMark(position);
    }
  }

  function handleResetKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetGame();
    }
  }

  function getCellPixel(position: Position): Position {
    return [
      BOARD_PANEL_X + BOARD_PANEL_PADDING + position[0] * CELL_SIZE,
      BOARD_PANEL_Y + BOARD_PANEL_PADDING + position[1] * CELL_SIZE,
    ];
  }

  function bevelTopLeftPoints(width: number, height: number, thickness: number): string {
    return `0,0 ${width},0 ${width - thickness},${thickness} ${thickness},${thickness} ${thickness},${height - thickness} 0,${height}`;
  }

  function bevelBottomRightPoints(width: number, height: number, thickness: number): string {
    return `${width},0 ${width},${height} 0,${height} ${thickness},${height - thickness} ${width - thickness},${height - thickness} ${width - thickness},${thickness}`;
  }
</script>

<section class="win98 my-4 w-full overflow-x-auto" aria-label="Windows 98 style Minesweeper clone">
  <svg
    class="mx-auto block min-w-fit bg-[#c0c0c0] select-none"
    width={viewportWidth}
    height={viewportHeight}
    viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
    role="img"
    aria-label="Windows 98 style Minesweeper clone"
    onmouseleave={clearPressState}
  >
    <defs>
      <linearGradient id="mine-title-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#000080" />
        <stop offset="100%" stop-color="#1084d0" />
      </linearGradient>
      <g id="counter-bevel">
        <polygon points={bevelTopLeftPoints(COUNTER_WIDTH, COUNTER_HEIGHT, 2)} fill="#808080" />
        <polygon points={bevelBottomRightPoints(COUNTER_WIDTH, COUNTER_HEIGHT, 2)} fill="#ffffff" />
      </g>
      <g id="cell-bevel-revealed">
        <polygon points={bevelTopLeftPoints(CELL_SIZE, CELL_SIZE, 1)} fill="#7b7b7b" />
      </g>
      <g id="cell-bevel-raised">
        <polygon points={bevelTopLeftPoints(CELL_SIZE, CELL_SIZE, 2)} fill="#ffffff" />
        <polygon points={bevelBottomRightPoints(CELL_SIZE, CELL_SIZE, 2)} fill="#808080" />
      </g>
      <g id="cell-bevel-pressed">
        <polygon points={bevelTopLeftPoints(CELL_SIZE, CELL_SIZE, 2)} fill="#808080" />
        <polygon points={bevelBottomRightPoints(CELL_SIZE, CELL_SIZE, 2)} fill="#ffffff" />
      </g>
      <g id="buoy">
        <image
          href={buoyImage.src}
          x={ICON_PADDING}
          y={ICON_PADDING}
          width={ICON_SIZE}
          height={ICON_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      <g id="waves">
        <image
          href={wavesImage.src}
          x={ICON_PADDING}
          y={ICON_PADDING}
          width={ICON_SIZE}
          height={ICON_SIZE}
          opacity="0.85"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </defs>

    <rect x="0" y="0" width={viewportWidth} height={viewportHeight} fill="#c0c0c0" />
    <polygon points={bevelTopLeftPoints(viewportWidth, viewportHeight, 2)} fill="#ffffff" />
    <polygon points={bevelBottomRightPoints(viewportWidth, viewportHeight, 2)} fill="#808080" />

    <rect
      x="2"
      y="2"
      width={viewportWidth - 4}
      height={TITLE_BAR_HEIGHT - 2}
      fill="url(#mine-title-gradient)"
    />
    <text x="10" y="16" class="fill-white text-[12px] font-bold tracking-wide">Mine!</text>

    {#each beveledPanels as panel (panel.id)}
      <g transform={`translate(${panel.x}, ${panel.y})`}>
        <rect x="0" y="0" width={panel.width} height={panel.height} fill={panel.fill} />
        <polygon points={bevelTopLeftPoints(panel.width, panel.height, 2)} fill="#808080" />
        <polygon points={bevelBottomRightPoints(panel.width, panel.height, 2)} fill="#ffffff" />
      </g>
    {/each}

    {#each counterPanels as counter (counter.id)}
      <g transform={`translate(${counter.x}, ${counter.y})`} aria-label={counter.label}>
        <rect x="0" y="0" width={COUNTER_WIDTH} height={COUNTER_HEIGHT} fill="#000000" />
        <use href="#counter-bevel" />
        <text
          x={COUNTER_WIDTH / 2}
          y="27"
          class="fill-[#ff1f1f] font-mono text-[30px] font-bold tracking-[1px]"
          text-anchor="middle"
        >
          {counter.value}
        </text>
      </g>
    {/each}

    <g
      transform={`translate(${resetButtonX}, ${STATUS_PANEL_Y + 9})`}
      role="button"
      tabindex="0"
      aria-label="New game"
      class="cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
      onclick={resetGame}
      onkeydown={handleResetKeydown}
    >
      <rect x="0" y="0" width={RESET_SIZE} height={RESET_SIZE} fill="#bdbdbd" />
      <polygon points={bevelTopLeftPoints(RESET_SIZE, RESET_SIZE, 2)} fill="#ffffff" />
      <polygon points={bevelBottomRightPoints(RESET_SIZE, RESET_SIZE, 2)} fill="#808080" />
      <image
        href={resetButtonImage.src}
        x="3"
        y="3"
        width={RESET_SIZE - 6}
        height={RESET_SIZE - 6}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>

    {#each board as row}
      {#each row as cell (cell.id)}
        {@const [cellX, cellY] = getCellPixel(cell.position)}
        {@const isPressed = pressedCellId === cell.id && !cell.revealed}
        <g
          transform={`translate(${cellX}, ${cellY})`}
          role="button"
          tabindex="0"
          class="cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
          aria-label={`Cell ${cell.position[0] + 1}, ${cell.position[1] + 1}`}
          onmousedown={(event) => handleCellMouseDown(event, cell.position)}
          onmouseup={clearPressState}
          onclick={() => handleCellClick(cell.position)}
          oncontextmenu={(event) => handleCellRightClick(event, cell.position)}
          onkeydown={(event) => handleCellKeydown(event, cell.position)}
        >
          <rect
            x="0"
            y="0"
            width={CELL_SIZE}
            height={CELL_SIZE}
            fill={cell.caught ? "#ff4b4b" : cell.revealed ? "#bdbdbd" : "#c0c0c0"}
          />

          {#if cell.revealed}
            <use href="#cell-bevel-revealed" pointer-events="none" />
          {:else}
            <use
              href={isPressed ? "#cell-bevel-pressed" : "#cell-bevel-raised"}
              pointer-events="none"
            />
          {/if}

          {#if cell.wrongBuoy}
            <use
              href="#buoy"
              transform={`rotate(${(Math.random() - 0.5) * 16}, ${ICON_SIZE / 2 + ICON_PADDING}, ${ICON_SIZE})`}
            />
            <use href="#waves" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="#cc0000" stroke-width="2" />
            <line x1="20" y1="4" x2="4" y2="20" stroke="#cc0000" stroke-width="2" />
          {:else if cell.revealed}
            {#if cell.isMine}
              <image
                href={seagullMineImage.src}
                x={ICON_PADDING}
                y={ICON_PADDING}
                width={ICON_SIZE}
                height={ICON_SIZE}
                preserveAspectRatio="xMidYMid meet"
              />
            {:else if cell.adjacent > 0}
              <text
                x="12"
                y="18"
                fill={NUMBER_COLORS[cell.adjacent]}
                class="text-[16px] font-bold"
                text-anchor="middle"
              >
                {cell.adjacent}
              </text>
            {/if}
          {:else if cell.mark === "buoy"}
            <use
              href="#buoy"
              transform={`rotate(${(Math.random() - 0.5) * 16}, ${ICON_SIZE / 2 + ICON_PADDING}, ${ICON_SIZE})`}
            />
            <use href="#waves" />
          {:else if cell.mark === "question"}
            <image
              href={seagullLookingImage.src}
              x={ICON_PADDING}
              y={ICON_PADDING}
              width={ICON_SIZE}
              height={ICON_SIZE}
              preserveAspectRatio="xMidYMid meet"
              transform={`rotate(${Math.floor(4 * Math.random()) * 90}, ${ICON_PADDING + ICON_SIZE / 2}, ${ICON_PADDING + ICON_SIZE / 2})`}
            />
          {/if}
        </g>
      {/each}
    {/each}
  </svg>
</section>
