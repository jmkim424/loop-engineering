(function () {
  'use strict';

  var BOARD_WIDTH = 10;
  var BOARD_HEIGHT = 20;
  var EMPTY_CELL = 0;

  var GAME_STATUS = Object.freeze({
    READY: 'READY',
    PLAYING: 'PLAYING',
    LANDED: 'LANDED',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
  });

  var TETROMINO_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  var TETROMINOES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  };

  var STORAGE_KEY = 'tetris-loop.leaderboard.v1';
  var NAME_MIN_LENGTH = 2;
  var NAME_MAX_LENGTH = 10;
  var LEADERBOARD_LIMIT = 10;
  var NAME_PATTERN = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$/;

  var LINES_PER_LEVEL = 2;
  var BASE_DROP_INTERVAL_MS = 700;
  var LEVEL_SPEED_STEP_MS = 60;
  var MIN_DROP_INTERVAL_MS = 100;

  var LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);
  var SOFT_DROP_POINT = 1;
  var HARD_DROP_POINT = 2;

  function createEmptyRow() {
    var row = [];
    for (var x = 0; x < BOARD_WIDTH; x++) {
      row.push(EMPTY_CELL);
    }
    return row;
  }

  function createEmptyBoard() {
    var board = [];
    for (var y = 0; y < BOARD_HEIGHT; y++) {
      board.push(createEmptyRow());
    }
    return board;
  }

  function copyBoard(board) {
    var out = [];
    for (var y = 0; y < board.length; y++) {
      out.push(board[y].slice());
    }
    return out;
  }

  function cloneMatrix(matrix) {
    var out = [];
    for (var y = 0; y < matrix.length; y++) {
      out.push(matrix[y].slice());
    }
    return out;
  }

  function copyState(state, changes) {
    var next = {
      board: state.board,
      score: state.score,
      lines: state.lines,
      status: state.status,
      piece: state.piece,
      randomizer: state.randomizer
    };
    for (var key in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        next[key] = changes[key];
      }
    }
    return next;
  }

  function copyPiece(piece, changes) {
    var next = {
      type: piece.type,
      matrix: piece.matrix,
      row: piece.row,
      col: piece.col
    };
    for (var key in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        next[key] = changes[key];
      }
    }
    return next;
  }

  function defaultRandomizer() {
    return TETROMINO_TYPES[Math.floor(Math.random() * TETROMINO_TYPES.length)];
  }

  function createInitialState(options) {
    var settings = options || {};
    return {
      board: createEmptyBoard(),
      score: 0,
      lines: 0,
      status: GAME_STATUS.READY,
      piece: null,
      randomizer: typeof settings.randomizer === 'function' ? settings.randomizer : defaultRandomizer
    };
  }

  function pieceCells(piece) {
    var cells = [];
    for (var y = 0; y < piece.matrix.length; y++) {
      for (var x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x] !== 0) {
          cells.push({ row: piece.row + y, col: piece.col + x });
        }
      }
    }
    return cells;
  }

  function canPlace(board, piece) {
    var cells = pieceCells(piece);
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.col < 0 || cell.col >= BOARD_WIDTH) {
        return false;
      }
      if (cell.row >= BOARD_HEIGHT) {
        return false;
      }
      if (cell.row >= 0 && board[cell.row][cell.col] !== EMPTY_CELL) {
        return false;
      }
    }
    return true;
  }

  function isOver(state) {
    return state.status === GAME_STATUS.GAME_OVER;
  }

  function spawnPiece(state) {
    var type = state.randomizer();
    var matrix = cloneMatrix(TETROMINOES[type]);
    var piece = {
      type: type,
      matrix: matrix,
      row: 0,
      col: Math.floor((BOARD_WIDTH - matrix.length) / 2)
    };
    if (!canPlace(state.board, piece)) {
      return copyState(state, { piece: null, status: GAME_STATUS.GAME_OVER });
    }
    return copyState(state, { piece: piece });
  }

  function movePiece(state, dx, dy) {
    if (isOver(state) || !state.piece) {
      return state;
    }
    var moved = copyPiece(state.piece, {
      row: state.piece.row + dy,
      col: state.piece.col + dx
    });
    if (!canPlace(state.board, moved)) {
      return state;
    }
    return copyState(state, { piece: moved });
  }

  function rotateMatrixClockwise(matrix) {
    var size = matrix.length;
    var out = [];
    for (var y = 0; y < size; y++) {
      var row = [];
      for (var x = 0; x < size; x++) {
        row.push(matrix[size - 1 - x][y]);
      }
      out.push(row);
    }
    return out;
  }

  function rotatePiece(state) {
    if (isOver(state) || !state.piece) {
      return state;
    }
    var rotated = copyPiece(state.piece, {
      matrix: rotateMatrixClockwise(state.piece.matrix)
    });
    if (!canPlace(state.board, rotated)) {
      return state;
    }
    return copyState(state, { piece: rotated });
  }

  function lockPiece(state) {
    if (!state.piece) {
      return state;
    }
    var board = copyBoard(state.board);
    var cells = pieceCells(state.piece);
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.row >= 0 && cell.row < BOARD_HEIGHT && cell.col >= 0 && cell.col < BOARD_WIDTH) {
        board[cell.row][cell.col] = state.piece.type;
      }
    }
    return copyState(state, { board: board, piece: null });
  }

  function findFullRows(board) {
    var rows = [];
    for (var y = 0; y < board.length; y++) {
      var full = true;
      for (var x = 0; x < board[y].length; x++) {
        if (board[y][x] === EMPTY_CELL) {
          full = false;
          break;
        }
      }
      if (full) {
        rows.push(y);
      }
    }
    return rows;
  }

  function clearRows(board, rows) {
    var removed = rows || [];
    var kept = [];
    for (var y = 0; y < board.length; y++) {
      if (removed.indexOf(y) === -1) {
        kept.push(board[y].slice());
      }
    }
    var out = [];
    var missing = board.length - kept.length;
    for (var n = 0; n < missing; n++) {
      out.push(createEmptyRow());
    }
    for (var k = 0; k < kept.length; k++) {
      out.push(kept[k]);
    }
    return out;
  }

  function lineScore(count) {
    if (count <= 0) {
      return 0;
    }
    if (count >= LINE_SCORES.length) {
      return LINE_SCORES[LINE_SCORES.length - 1];
    }
    return LINE_SCORES[count];
  }

  function levelFor(lines) {
    return Math.floor(lines / LINES_PER_LEVEL) + 1;
  }

  function dropIntervalFor(level) {
    var interval = BASE_DROP_INTERVAL_MS - (level - 1) * LEVEL_SPEED_STEP_MS;
    return interval < MIN_DROP_INTERVAL_MS ? MIN_DROP_INTERVAL_MS : interval;
  }

  function resolveLanding(state) {
    var locked = lockPiece(state);
    var full = findFullRows(locked.board);
    var multiplier = levelFor(locked.lines);
    var cleared = copyState(locked, {
      board: clearRows(locked.board, full),
      lines: locked.lines + full.length,
      score: locked.score + lineScore(full.length) * multiplier
    });
    return spawnPiece(cleared);
  }

  function stepDown(state) {
    if (isOver(state) || !state.piece) {
      return state;
    }
    var moved = copyPiece(state.piece, { row: state.piece.row + 1 });
    if (canPlace(state.board, moved)) {
      return copyState(state, { piece: moved });
    }
    return resolveLanding(state);
  }

  function softDrop(state) {
    if (isOver(state) || !state.piece) {
      return state;
    }
    var moved = copyPiece(state.piece, { row: state.piece.row + 1 });
    if (canPlace(state.board, moved)) {
      return copyState(state, {
        piece: moved,
        score: state.score + SOFT_DROP_POINT
      });
    }
    return resolveLanding(state);
  }

  function hardDrop(state) {
    if (isOver(state) || !state.piece) {
      return state;
    }
    var row = state.piece.row;
    var distance = 0;
    while (distance < BOARD_HEIGHT) {
      if (!canPlace(state.board, copyPiece(state.piece, { row: row + 1 }))) {
        break;
      }
      row += 1;
      distance += 1;
    }
    var dropped = copyState(state, {
      piece: copyPiece(state.piece, { row: row }),
      score: state.score + distance * HARD_DROP_POINT
    });
    return resolveLanding(dropped);
  }

  function startGame(state) {
    var fresh = createInitialState({
      randomizer: state && state.randomizer ? state.randomizer : undefined
    });
    return spawnPiece(copyState(fresh, { status: GAME_STATUS.PLAYING }));
  }

  function validateName(raw) {
    var name = typeof raw === 'string' ? raw.trim() : '';
    if (name.length === 0) {
      return { valid: false, name: name, reason: '이름을 입력하세요.' };
    }
    if (name.length < NAME_MIN_LENGTH) {
      return { valid: false, name: name, reason: '이름은 ' + NAME_MIN_LENGTH + '자 이상이어야 합니다.' };
    }
    if (name.length > NAME_MAX_LENGTH) {
      return { valid: false, name: name, reason: '이름은 ' + NAME_MAX_LENGTH + '자 이하여야 합니다.' };
    }
    if (!NAME_PATTERN.test(name)) {
      return { valid: false, name: name, reason: '이름에는 한글, 영문, 숫자만 쓸 수 있습니다.' };
    }
    return { valid: true, name: name, reason: '' };
  }

  function createEntry(name, score, clearedLines, id, playedAt) {
    return {
      id: id,
      name: name,
      score: score,
      clearedLines: clearedLines,
      playedAt: playedAt
    };
  }

  function compareEntries(a, b) {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    if (a.name !== b.name) {
      return a.name < b.name ? -1 : 1;
    }
    if (a.playedAt !== b.playedAt) {
      return a.playedAt < b.playedAt ? -1 : 1;
    }
    return 0;
  }

  function sortEntries(entries) {
    return entries.slice().sort(compareEntries);
  }

  function addEntry(entries, entry) {
    return sortEntries(entries.concat([entry])).slice(0, LEADERBOARD_LIMIT);
  }

  function isValidEntry(item) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    if (typeof item.id !== 'string' || typeof item.name !== 'string') {
      return false;
    }
    if (typeof item.score !== 'number' || !isFinite(item.score)) {
      return false;
    }
    if (typeof item.clearedLines !== 'number' || !isFinite(item.clearedLines)) {
      return false;
    }
    return typeof item.playedAt === 'string';
  }

  function parseEntries(text) {
    if (typeof text !== 'string') {
      return [];
    }
    var data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      return [];
    }
    if (!Array.isArray(data)) {
      return [];
    }
    for (var i = 0; i < data.length; i++) {
      if (!isValidEntry(data[i])) {
        return [];
      }
    }
    return data;
  }

  function loadLeaderboard(storage) {
    try {
      return parseEntries(storage.getItem(STORAGE_KEY));
    } catch (error) {
      return [];
    }
  }

  function saveLeaderboard(storage, entries) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, LEADERBOARD_LIMIT)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearLeaderboard(storage) {
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  function toRenderBoard(state) {
    var view = copyBoard(state.board);
    if (state.piece) {
      var cells = pieceCells(state.piece);
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (cell.row >= 0 && cell.row < BOARD_HEIGHT && cell.col >= 0 && cell.col < BOARD_WIDTH) {
          view[cell.row][cell.col] = state.piece.type;
        }
      }
    }
    return view;
  }

  globalThis.TetrisGame = {
    BOARD_WIDTH: BOARD_WIDTH,
    BOARD_HEIGHT: BOARD_HEIGHT,
    GAME_STATUS: GAME_STATUS,
    TETROMINO_TYPES: TETROMINO_TYPES,
    TETROMINOES: TETROMINOES,
    createEmptyBoard: createEmptyBoard,
    createInitialState: createInitialState,
    canPlace: canPlace,
    spawnPiece: spawnPiece,
    movePiece: movePiece,
    rotatePiece: rotatePiece,
    lockPiece: lockPiece,
    findFullRows: findFullRows,
    clearRows: clearRows,
    resolveLanding: resolveLanding,
    LINES_PER_LEVEL: LINES_PER_LEVEL,
    BASE_DROP_INTERVAL_MS: BASE_DROP_INTERVAL_MS,
    LEVEL_SPEED_STEP_MS: LEVEL_SPEED_STEP_MS,
    MIN_DROP_INTERVAL_MS: MIN_DROP_INTERVAL_MS,
    levelFor: levelFor,
    dropIntervalFor: dropIntervalFor,
    LINE_SCORES: LINE_SCORES,
    SOFT_DROP_POINT: SOFT_DROP_POINT,
    HARD_DROP_POINT: HARD_DROP_POINT,
    lineScore: lineScore,
    stepDown: stepDown,
    softDrop: softDrop,
    hardDrop: hardDrop,
    startGame: startGame,
    toRenderBoard: toRenderBoard,
    STORAGE_KEY: STORAGE_KEY,
    NAME_MIN_LENGTH: NAME_MIN_LENGTH,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH,
    LEADERBOARD_LIMIT: LEADERBOARD_LIMIT,
    validateName: validateName,
    createEntry: createEntry,
    sortEntries: sortEntries,
    addEntry: addEntry,
    parseEntries: parseEntries,
    loadLeaderboard: loadLeaderboard,
    saveLeaderboard: saveLeaderboard,
    clearLeaderboard: clearLeaderboard
  };
})();
