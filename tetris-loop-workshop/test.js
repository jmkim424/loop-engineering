(function () {
  'use strict';

  var results = [];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function test(name, body) {
    try {
      body();
      results.push({ name: name, ok: true, reason: '' });
    } catch (error) {
      results.push({ name: name, ok: false, reason: error.message });
    }
  }

  var G = globalThis.TetrisGame;

  function fixedState(type) {
    return G.createInitialState({
      randomizer: function () {
        return type;
      }
    });
  }

  function pieceAt(type, row, col) {
    var state = G.spawnPiece(fixedState(type));
    state.piece.row = row;
    state.piece.col = col;
    return state;
  }

  function sameMatrix(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (var y = 0; y < a.length; y++) {
      if (a[y].length !== b[y].length) {
        return false;
      }
      for (var x = 0; x < a[y].length; x++) {
        if (a[y][x] !== b[y][x]) {
          return false;
        }
      }
    }
    return true;
  }

  // --- SPEC_00: 골격과 초기 상태 ---

  test('globalThis.TetrisGame이 존재한다', function () {
    assert(G && typeof G === 'object', 'TetrisGame이 객체가 아니다');
  });

  test('필수 함수가 존재한다', function () {
    assert(typeof G.createEmptyBoard === 'function', 'createEmptyBoard가 함수가 아니다');
    assert(typeof G.createInitialState === 'function', 'createInitialState가 함수가 아니다');
  });

  test('BOARD_WIDTH가 10이다', function () {
    assert(G.BOARD_WIDTH === 10, '실제 값: ' + G.BOARD_WIDTH);
  });

  test('BOARD_HEIGHT가 20이다', function () {
    assert(G.BOARD_HEIGHT === 20, '실제 값: ' + G.BOARD_HEIGHT);
  });

  test('GAME_STATUS가 다섯 개 상태를 가진다', function () {
    var names = ['READY', 'PLAYING', 'LANDED', 'PAUSED', 'GAME_OVER'];
    for (var i = 0; i < names.length; i++) {
      assert(G.GAME_STATUS[names[i]] === names[i], names[i] + ' 값이 다르다');
    }
  });

  test('빈 보드가 20행이다', function () {
    assert(G.createEmptyBoard().length === 20, '실제 행 수: ' + G.createEmptyBoard().length);
  });

  test('빈 보드의 각 행이 10셀이다', function () {
    var board = G.createEmptyBoard();
    for (var y = 0; y < board.length; y++) {
      assert(board[y].length === 10, y + '행의 셀 수: ' + board[y].length);
    }
  });

  test('빈 보드의 모든 셀이 0이다', function () {
    var board = G.createEmptyBoard();
    for (var y = 0; y < board.length; y++) {
      for (var x = 0; x < board[y].length; x++) {
        assert(board[y][x] === 0, y + ',' + x + ' 셀 값: ' + board[y][x]);
      }
    }
  });

  test('한 보드 안의 행들이 서로 독립적이다', function () {
    var board = G.createEmptyBoard();
    board[0][0] = 9;
    assert(board[1][0] === 0, '행 배열이 공유되고 있다');
  });

  test('두 번 만든 보드가 행 배열을 공유하지 않는다', function () {
    var first = G.createEmptyBoard();
    var second = G.createEmptyBoard();
    first[0][0] = 9;
    assert(first[0] !== second[0], '두 보드가 같은 행 배열을 가리킨다');
    assert(second[0][0] === 0, '한쪽 수정이 다른 보드에 반영되었다');
  });

  test('초기 상태의 보드가 20x10 빈 보드다', function () {
    var state = G.createInitialState();
    assert(state.board.length === 20, '행 수: ' + state.board.length);
    assert(state.board[0].length === 10, '열 수: ' + state.board[0].length);
    assert(state.board[19][9] === 0, '마지막 셀이 비어 있지 않다');
  });

  test('초기 상태의 점수가 0이다', function () {
    assert(G.createInitialState().score === 0, '실제 값: ' + G.createInitialState().score);
  });

  test('초기 상태의 제거한 줄이 0이다', function () {
    assert(G.createInitialState().lines === 0, '실제 값: ' + G.createInitialState().lines);
  });

  test('초기 상태의 게임 상태가 READY다', function () {
    assert(G.createInitialState().status === 'READY', '실제 값: ' + G.createInitialState().status);
  });

  test('초기 상태를 두 번 만들면 서로 다른 보드다', function () {
    var a = G.createInitialState();
    var b = G.createInitialState();
    assert(a.board !== b.board, '두 상태가 같은 보드를 공유한다');
  });

  // --- SPEC_01: 조각 정의 ---

  test('TETROMINO_TYPES가 일곱 종류다', function () {
    var expected = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    assert(G.TETROMINO_TYPES.length === 7, '개수: ' + G.TETROMINO_TYPES.length);
    for (var i = 0; i < expected.length; i++) {
      assert(G.TETROMINO_TYPES[i] === expected[i], i + '번째 값: ' + G.TETROMINO_TYPES[i]);
    }
  });

  test('일곱 기준 행렬이 SPEC 표와 일치한다', function () {
    var expected = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
    };
    for (var i = 0; i < G.TETROMINO_TYPES.length; i++) {
      var type = G.TETROMINO_TYPES[i];
      assert(sameMatrix(G.TETROMINOES[type], expected[type]), type + ' 행렬이 다르다');
    }
  });

  // --- SPEC_01: 생성기 주입 ---

  test('초기 상태의 조각은 null이다', function () {
    assert(G.createInitialState().piece === null, '조각이 null이 아니다');
  });

  test('주입한 생성기가 spawnPiece에서 사용된다', function () {
    var calls = 0;
    var state = G.createInitialState({
      randomizer: function () {
        calls++;
        return 'Z';
      }
    });
    var spawned = G.spawnPiece(state);
    assert(calls === 1, '생성기 호출 횟수: ' + calls);
    assert(spawned.piece.type === 'Z', '조각 종류: ' + spawned.piece.type);
  });

  test('생성기를 주입하지 않으면 기본 생성기가 일곱 종류 중 하나를 반환한다', function () {
    var state = G.createInitialState();
    assert(typeof state.randomizer === 'function', '기본 생성기가 없다');
    for (var i = 0; i < 50; i++) {
      var type = state.randomizer();
      assert(G.TETROMINO_TYPES.indexOf(type) !== -1, '알 수 없는 종류: ' + type);
    }
  });

  // --- SPEC_01: 생성 위치 ---

  test('I 조각이 0행 3열에 생성된다', function () {
    var piece = G.spawnPiece(fixedState('I')).piece;
    assert(piece.row === 0, 'row: ' + piece.row);
    assert(piece.col === 3, 'col: ' + piece.col);
  });

  test('O 조각이 0행 4열에 생성된다', function () {
    var piece = G.spawnPiece(fixedState('O')).piece;
    assert(piece.row === 0, 'row: ' + piece.row);
    assert(piece.col === 4, 'col: ' + piece.col);
  });

  test('T 조각이 0행 3열에 생성된다', function () {
    var piece = G.spawnPiece(fixedState('T')).piece;
    assert(piece.row === 0, 'row: ' + piece.row);
    assert(piece.col === 3, 'col: ' + piece.col);
  });

  test('생성된 조각이 기준 행렬을 공유하지 않는다', function () {
    var state = G.spawnPiece(fixedState('T'));
    state.piece.matrix[0][0] = 9;
    assert(G.TETROMINOES.T[0][0] === 0, '기준 행렬이 오염되었다');
  });

  // --- SPEC_01: 이동 ---

  test('경계 안에서 좌우 아래로 한 칸씩 이동한다', function () {
    var state = G.spawnPiece(fixedState('T'));
    assert(G.movePiece(state, -1, 0).piece.col === 2, '왼쪽 이동 실패');
    assert(G.movePiece(state, 1, 0).piece.col === 4, '오른쪽 이동 실패');
    assert(G.movePiece(state, 0, 1).piece.row === 1, '아래 이동 실패');
  });

  test('왼쪽 벽에서 더 왼쪽으로 가지 않는다', function () {
    var state = pieceAt('T', 0, 0);
    var moved = G.movePiece(state, -1, 0);
    assert(moved.piece.col === 0, 'col: ' + moved.piece.col);
  });

  test('오른쪽 벽에서 더 오른쪽으로 가지 않는다', function () {
    var state = pieceAt('T', 0, 7);
    var moved = G.movePiece(state, 1, 0);
    assert(moved.piece.col === 7, 'col: ' + moved.piece.col);
  });

  test('바닥에서 더 아래로 가지 않는다', function () {
    var state = pieceAt('T', 18, 3);
    var moved = G.movePiece(state, 0, 1);
    assert(moved.piece.row === 18, 'row: ' + moved.piece.row);
  });

  // --- SPEC_01: 회전 ---

  test('T를 한 번 회전하면 시계방향 결과가 나온다', function () {
    var rotated = G.rotatePiece(G.spawnPiece(fixedState('T'))).piece.matrix;
    var expected = [[0, 1, 0], [0, 1, 1], [0, 1, 0]];
    assert(sameMatrix(rotated, expected), '회전 결과: ' + JSON.stringify(rotated));
  });

  test('네 번 회전하면 기준 행렬로 돌아온다', function () {
    var state = G.spawnPiece(fixedState('J'));
    for (var i = 0; i < 4; i++) {
      state = G.rotatePiece(state);
    }
    assert(sameMatrix(state.piece.matrix, G.TETROMINOES.J), '네 번 회전 후 모양이 다르다');
  });

  test('회전 결과가 보드 밖이면 회전하지 않는다', function () {
    var vertical = G.rotatePiece(G.spawnPiece(fixedState('I')));
    var atWall = vertical;
    atWall.piece.col = 7;
    var before = JSON.stringify(atWall.piece.matrix);
    var after = G.rotatePiece(atWall);
    assert(JSON.stringify(after.piece.matrix) === before, '회전이 적용되었다');
    assert(after.piece.col === 7, 'col이 바뀌었다: ' + after.piece.col);
  });

  // --- SPEC_01: 낙하와 착지 ---

  test('stepDown이 조각을 한 칸 내린다', function () {
    var state = G.spawnPiece(fixedState('T'));
    assert(G.stepDown(state).piece.row === 1, 'row가 1이 아니다');
  });

  test('바닥에 닿으면 stepDown이 LANDED로 바꾼다', function () {
    var state = pieceAt('I', 18, 3);
    var landed = G.stepDown(state);
    assert(landed.status === G.GAME_STATUS.LANDED, '상태: ' + landed.status);
  });

  test('LANDED가 된 뒤에는 조각 위치가 그대로다', function () {
    var state = pieceAt('I', 18, 3);
    var landed = G.stepDown(state);
    assert(landed.piece.row === 18, 'row: ' + landed.piece.row);
  });

  // --- SPEC_01: 렌더 배열과 재시작 ---

  test('toRenderBoard가 조각 칸에 종류 문자열을 채운다', function () {
    var view = G.toRenderBoard(G.spawnPiece(fixedState('O')));
    assert(view[0][4] === 'O', '0,4 값: ' + view[0][4]);
    assert(view[0][5] === 'O', '0,5 값: ' + view[0][5]);
    assert(view[1][4] === 'O', '1,4 값: ' + view[1][4]);
    assert(view[1][5] === 'O', '1,5 값: ' + view[1][5]);
  });

  test('toRenderBoard의 나머지 칸은 0이다', function () {
    var view = G.toRenderBoard(G.spawnPiece(fixedState('O')));
    var filled = 0;
    for (var y = 0; y < view.length; y++) {
      for (var x = 0; x < view[y].length; x++) {
        if (view[y][x] !== 0) {
          filled++;
        }
      }
    }
    assert(filled === 4, '채워진 칸 수: ' + filled);
  });

  test('toRenderBoard가 원본 보드를 바꾸지 않는다', function () {
    var state = G.spawnPiece(fixedState('O'));
    G.toRenderBoard(state);
    assert(state.board[0][4] === 0, '원본 보드가 바뀌었다');
  });

  test('startGame이 PLAYING으로 바꾸고 조각을 하나 만든다', function () {
    var state = G.startGame(fixedState('L'));
    assert(state.status === G.GAME_STATUS.PLAYING, '상태: ' + state.status);
    assert(state.piece !== null, '조각이 없다');
    assert(state.piece.type === 'L', '조각 종류: ' + state.piece.type);
  });

  test('startGame이 보드와 점수와 줄을 초기화한다', function () {
    var dirty = pieceAt('T', 10, 5);
    dirty.score = 500;
    dirty.lines = 7;
    dirty.board[19][0] = 'T';
    var restarted = G.startGame(dirty);
    assert(restarted.score === 0, '점수: ' + restarted.score);
    assert(restarted.lines === 0, '줄: ' + restarted.lines);
    assert(restarted.board[19][0] === 0, '보드가 초기화되지 않았다');
    assert(restarted.piece.row === 0, '새 조각의 row: ' + restarted.piece.row);
  });

  test('startGame이 주입한 생성기를 유지한다', function () {
    var restarted = G.startGame(G.startGame(fixedState('S')));
    assert(restarted.piece.type === 'S', '조각 종류: ' + restarted.piece.type);
  });

  // --- SPEC_02: 충돌 판정 ---

  function emptyBoard() {
    return G.createEmptyBoard();
  }

  function fillRow(board, row, exceptCols) {
    for (var x = 0; x < 10; x++) {
      if (exceptCols.indexOf(x) === -1) {
        board[row][x] = 'I';
      }
    }
    return board;
  }

  function placed(board, type, row, col) {
    var state = G.createInitialState({
      randomizer: function () {
        return type;
      }
    });
    state.board = board;
    state.status = G.GAME_STATUS.PLAYING;
    state.piece = {
      type: type,
      matrix: G.TETROMINOES[type].map(function (r) {
        return r.slice();
      }),
      row: row,
      col: col
    };
    return state;
  }

  test('canPlace가 빈 보드의 유효한 위치에 true를 준다', function () {
    var state = placed(emptyBoard(), 'O', 0, 4);
    assert(G.canPlace(state.board, state.piece) === true, 'false가 나왔다');
  });

  test('canPlace가 고정 블록과 겹치는 위치에 false를 준다', function () {
    var board = emptyBoard();
    board[5][4] = 'T';
    var state = placed(board, 'O', 5, 4);
    assert(G.canPlace(state.board, state.piece) === false, 'true가 나왔다');
  });

  test('고정 블록과 겹치는 이동은 무시된다', function () {
    var board = emptyBoard();
    board[0][6] = 'T';
    var state = placed(board, 'O', 0, 4);
    var moved = G.movePiece(state, 1, 0);
    assert(moved.piece.col === 4, 'col: ' + moved.piece.col);
  });

  test('고정 블록과 겹치는 회전은 무시된다', function () {
    var board = emptyBoard();
    board[2][5] = 'T';
    var state = placed(board, 'I', 0, 3);
    var before = JSON.stringify(state.piece.matrix);
    var rotated = G.rotatePiece(state);
    assert(JSON.stringify(rotated.piece.matrix) === before, '회전이 적용되었다');
  });

  // --- SPEC_02: 고정 ---

  test('lockPiece가 조각 칸에 종류 문자열을 쓴다', function () {
    var locked = G.lockPiece(placed(emptyBoard(), 'O', 18, 4));
    assert(locked.board[18][4] === 'O', '18,4: ' + locked.board[18][4]);
    assert(locked.board[19][5] === 'O', '19,5: ' + locked.board[19][5]);
  });

  test('lockPiece 후 piece가 null이다', function () {
    var locked = G.lockPiece(placed(emptyBoard(), 'O', 18, 4));
    assert(locked.piece === null, 'piece가 남아 있다');
  });

  test('lockPiece가 원본 보드를 바꾸지 않는다', function () {
    var state = placed(emptyBoard(), 'O', 18, 4);
    G.lockPiece(state);
    assert(state.board[18][4] === 0, '원본이 바뀌었다');
  });

  // --- SPEC_02: 줄 탐색과 제거 ---

  test('findFullRows가 가득 찬 행 하나를 찾는다', function () {
    var board = fillRow(emptyBoard(), 19, []);
    assert(JSON.stringify(G.findFullRows(board)) === '[19]', JSON.stringify(G.findFullRows(board)));
  });

  test('findFullRows가 두 행을 오름차순으로 찾는다', function () {
    var board = fillRow(fillRow(emptyBoard(), 19, []), 18, []);
    assert(JSON.stringify(G.findFullRows(board)) === '[18,19]', JSON.stringify(G.findFullRows(board)));
  });

  test('findFullRows가 가득 찬 행이 없으면 빈 배열을 준다', function () {
    var board = fillRow(emptyBoard(), 19, [3]);
    assert(G.findFullRows(board).length === 0, JSON.stringify(G.findFullRows(board)));
  });

  test('clearRows가 지정한 행을 없앤다', function () {
    var board = fillRow(emptyBoard(), 19, []);
    var cleared = G.clearRows(board, [19]);
    assert(cleared[19].join('') === '0000000000', '19행: ' + cleared[19].join(''));
  });

  test('clearRows 후 위쪽 행이 아래로 내려온다', function () {
    var board = emptyBoard();
    fillRow(board, 19, []);
    board[18][0] = 'T';
    var cleared = G.clearRows(board, [19]);
    assert(cleared[19][0] === 'T', '19,0: ' + cleared[19][0]);
    assert(cleared[18][0] === 0, '18,0: ' + cleared[18][0]);
  });

  test('clearRows 후에도 보드가 20행 10열이다', function () {
    var cleared = G.clearRows(fillRow(emptyBoard(), 19, []), [19]);
    assert(cleared.length === 20, '행 수: ' + cleared.length);
    for (var y = 0; y < cleared.length; y++) {
      assert(cleared[y].length === 10, y + '행 열 수: ' + cleared[y].length);
    }
  });

  test('clearRows 후 맨 위 행이 비어 있다', function () {
    var cleared = G.clearRows(fillRow(emptyBoard(), 19, []), [19]);
    assert(cleared[0].join('') === '0000000000', '0행: ' + cleared[0].join(''));
  });

  // --- SPEC_02: 착지 순서 ---

  test('한 줄이 완성되면 lines가 1 늘어난다', function () {
    var board = fillRow(emptyBoard(), 19, [8, 9]);
    var landed = G.stepDown(placed(board, 'O', 18, 8));
    assert(landed.lines === 1, 'lines: ' + landed.lines);
  });

  test('두 줄이 동시에 완성되면 lines가 2 늘어난다', function () {
    var board = emptyBoard();
    fillRow(board, 19, [8, 9]);
    fillRow(board, 18, [8, 9]);
    var landed = G.stepDown(placed(board, 'O', 18, 8));
    assert(landed.lines === 2, 'lines: ' + landed.lines);
  });

  test('착지 처리 후 새 조각이 0행에 생성된다', function () {
    var landed = G.stepDown(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.piece !== null, '새 조각이 없다');
    assert(landed.piece.row === 0, 'row: ' + landed.piece.row);
  });

  test('착지 처리 후 status가 PLAYING이다', function () {
    var landed = G.stepDown(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.status === G.GAME_STATUS.PLAYING, 'status: ' + landed.status);
  });

  test('어떤 경로에서도 LANDED가 나오지 않는다', function () {
    var landed = G.stepDown(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.status !== G.GAME_STATUS.LANDED, 'LANDED가 나왔다');
    var again = G.stepDown(G.stepDown(landed));
    assert(again.status !== G.GAME_STATUS.LANDED, '두 번째에 LANDED가 나왔다');
  });

  test('고정된 블록 위에 다음 조각이 멈춘다', function () {
    var board = emptyBoard();
    board[19][4] = 'O';
    board[19][5] = 'O';
    board[18][4] = 'O';
    board[18][5] = 'O';
    var landed = G.stepDown(placed(board, 'O', 16, 4));
    assert(landed.board[17][4] === 'O', '17,4: ' + landed.board[17][4]);
    assert(landed.board[16][4] === 'O', '16,4: ' + landed.board[16][4]);
  });

  // --- SPEC_02: 게임오버 ---

  function blockedState() {
    var state = G.createInitialState({
      randomizer: function () {
        return 'O';
      }
    });
    state.board = fillRow(emptyBoard(), 0, []);
    state.status = G.GAME_STATUS.PLAYING;
    return state;
  }

  test('생성 위치가 막히면 GAME_OVER가 된다', function () {
    var spawned = G.spawnPiece(blockedState());
    assert(spawned.status === G.GAME_STATUS.GAME_OVER, 'status: ' + spawned.status);
  });

  test('GAME_OVER가 되면 piece가 null이다', function () {
    assert(G.spawnPiece(blockedState()).piece === null, 'piece가 남아 있다');
  });

  test('GAME_OVER에서 stepDown이 상태를 바꾸지 않는다', function () {
    var over = G.createInitialState();
    over.status = G.GAME_STATUS.GAME_OVER;
    assert(G.stepDown(over) === over, '새 상태가 반환되었다');
  });

  test('GAME_OVER에서 movePiece가 상태를 바꾸지 않는다', function () {
    var over = placed(emptyBoard(), 'O', 5, 4);
    over.status = G.GAME_STATUS.GAME_OVER;
    assert(G.movePiece(over, -1, 0) === over, '새 상태가 반환되었다');
  });

  test('startGame이 GAME_OVER에서 빈 보드로 되돌린다', function () {
    var over = placed(fillRow(emptyBoard(), 0, []), 'O', 5, 4);
    over.status = G.GAME_STATUS.GAME_OVER;
    over.lines = 9;
    var restarted = G.startGame(over);
    assert(restarted.status === G.GAME_STATUS.PLAYING, 'status: ' + restarted.status);
    assert(restarted.lines === 0, 'lines: ' + restarted.lines);
    assert(restarted.board[0][0] === 0, '0,0: ' + restarted.board[0][0]);
  });

  test('score가 어떤 경우에도 0을 유지한다', function () {
    var board = fillRow(emptyBoard(), 19, [8, 9]);
    var landed = G.stepDown(placed(board, 'O', 18, 8));
    assert(landed.score === 0, 'score: ' + landed.score);
    assert(G.startGame(landed).score === 0, '재시작 후 score가 0이 아니다');
  });

  // --- SPEC_03: 점수 상수 ---

  test('LINE_SCORES가 [0, 100, 300, 500, 800]이다', function () {
    assert(JSON.stringify(G.LINE_SCORES) === '[0,100,300,500,800]', JSON.stringify(G.LINE_SCORES));
  });

  test('lineScore가 줄 수에 맞는 점수를 준다', function () {
    var want = [0, 100, 300, 500, 800];
    for (var n = 0; n <= 4; n++) {
      assert(G.lineScore(n) === want[n], n + '줄: ' + G.lineScore(n));
    }
  });

  test('lineScore가 범위를 넘으면 800을 넘지 않는다', function () {
    assert(G.lineScore(5) === 800, '5줄: ' + G.lineScore(5));
    assert(G.lineScore(-1) === 0, '-1줄: ' + G.lineScore(-1));
  });

  // --- SPEC_03: 줄 제거 점수 ---

  test('한 줄을 지우면 score가 100 늘어난다', function () {
    var landed = G.stepDown(placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 18, 8));
    assert(landed.score === 100, 'score: ' + landed.score);
  });

  test('두 줄을 동시에 지우면 score가 300 늘어난다', function () {
    var board = emptyBoard();
    fillRow(board, 19, [8, 9]);
    fillRow(board, 18, [8, 9]);
    var landed = G.stepDown(placed(board, 'O', 18, 8));
    assert(landed.score === 300, 'score: ' + landed.score);
  });

  test('네 줄을 동시에 지우면 score가 800 늘어난다', function () {
    var board = emptyBoard();
    for (var y = 16; y <= 19; y++) {
      fillRow(board, y, [9]);
    }
    var vertical = placed(board, 'I', 16, 7);
    vertical.piece.matrix = [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0]
    ];
    var landed = G.resolveLanding(vertical);
    assert(landed.lines === 4, 'lines: ' + landed.lines);
    assert(landed.score === 800, 'score: ' + landed.score);
  });

  // --- SPEC_03: 소프트 드롭 ---

  test('softDrop이 조각을 한 칸 내린다', function () {
    var dropped = G.softDrop(placed(emptyBoard(), 'O', 5, 4));
    assert(dropped.piece.row === 6, 'row: ' + dropped.piece.row);
  });

  test('softDrop 한 번에 score가 1 늘어난다', function () {
    var dropped = G.softDrop(placed(emptyBoard(), 'O', 5, 4));
    assert(dropped.score === 1, 'score: ' + dropped.score);
  });

  test('softDrop을 다섯 번 하면 score가 5다', function () {
    var state = placed(emptyBoard(), 'O', 0, 4);
    for (var i = 0; i < 5; i++) {
      state = G.softDrop(state);
    }
    assert(state.score === 5, 'score: ' + state.score);
    assert(state.piece.row === 5, 'row: ' + state.piece.row);
  });

  test('내려갈 수 없으면 softDrop이 점수를 주지 않는다', function () {
    var landed = G.softDrop(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.score === 0, 'score: ' + landed.score);
  });

  test('내려갈 수 없으면 softDrop이 착지 순서를 수행한다', function () {
    var landed = G.softDrop(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.board[18][4] === 'O', '고정되지 않았다');
    assert(landed.piece.row === 0, '새 조각이 없다');
  });

  test('자동 낙하 stepDown은 score를 늘리지 않는다', function () {
    var dropped = G.stepDown(placed(emptyBoard(), 'O', 5, 4));
    assert(dropped.score === 0, 'score: ' + dropped.score);
  });

  // --- SPEC_03: 하드 드롭 ---

  test('hardDrop이 조각을 바닥까지 내려 고정한다', function () {
    var landed = G.hardDrop(placed(emptyBoard(), 'O', 0, 4));
    assert(landed.board[19][4] === 'O', '19,4: ' + landed.board[19][4]);
    assert(landed.board[18][4] === 'O', '18,4: ' + landed.board[18][4]);
  });

  test('hardDrop이 내려간 칸 수 곱하기 2를 준다', function () {
    var landed = G.hardDrop(placed(emptyBoard(), 'O', 0, 4));
    assert(landed.score === 36, 'score: ' + landed.score);
  });

  test('hardDrop 후 새 조각이 생성된다', function () {
    var landed = G.hardDrop(placed(emptyBoard(), 'O', 0, 4));
    assert(landed.piece !== null, '새 조각이 없다');
    assert(landed.piece.row === 0, 'row: ' + landed.piece.row);
  });

  test('hardDrop이 쌓인 블록 위에 멈춘다', function () {
    var board = emptyBoard();
    board[19][4] = 'T';
    board[19][5] = 'T';
    var landed = G.hardDrop(placed(board, 'O', 0, 4));
    assert(landed.board[18][4] === 'O', '18,4: ' + landed.board[18][4]);
    assert(landed.board[17][4] === 'O', '17,4: ' + landed.board[17][4]);
    assert(landed.score === 34, 'score: ' + landed.score);
  });

  test('0칸 hardDrop은 점수를 주지 않는다', function () {
    var landed = G.hardDrop(placed(emptyBoard(), 'O', 18, 4));
    assert(landed.score === 0, 'score: ' + landed.score);
    assert(landed.board[19][4] === 'O', '고정되지 않았다');
  });

  test('하드 드롭과 줄 제거 점수가 더해진다', function () {
    var landed = G.hardDrop(placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 0, 8));
    assert(landed.lines === 1, 'lines: ' + landed.lines);
    assert(landed.score === 136, 'score: ' + landed.score);
  });

  // --- SPEC_03: 재시작과 게임오버 ---

  test('startGame이 score를 0으로 되돌린다', function () {
    var scored = G.hardDrop(placed(emptyBoard(), 'O', 0, 4));
    assert(scored.score > 0, '점수가 오르지 않았다');
    assert(G.startGame(scored).score === 0, 'score: ' + G.startGame(scored).score);
  });

  test('startGame이 lines를 0으로 되돌린다', function () {
    var scored = G.stepDown(placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 18, 8));
    assert(scored.lines === 1, 'lines: ' + scored.lines);
    assert(G.startGame(scored).lines === 0, 'lines: ' + G.startGame(scored).lines);
  });

  test('GAME_OVER에서 softDrop이 상태를 바꾸지 않는다', function () {
    var over = placed(emptyBoard(), 'O', 5, 4);
    over.status = G.GAME_STATUS.GAME_OVER;
    assert(G.softDrop(over) === over, '새 상태가 반환되었다');
  });

  test('GAME_OVER에서 hardDrop이 상태를 바꾸지 않는다', function () {
    var over = placed(emptyBoard(), 'O', 5, 4);
    over.status = G.GAME_STATUS.GAME_OVER;
    assert(G.hardDrop(over) === over, '새 상태가 반환되었다');
  });

  // --- SPEC_04: 리더보드 ---

  function fakeStorage(initial) {
    var data = typeof initial === 'undefined' ? null : initial;
    return {
      lastKey: '',
      getItem: function () {
        return data;
      },
      setItem: function (key, value) {
        this.lastKey = key;
        data = value;
      },
      removeItem: function (key) {
        this.lastKey = key;
        data = null;
      }
    };
  }

  function throwingStorage() {
    return {
      getItem: function () {
        throw new Error('blocked');
      },
      setItem: function () {
        throw new Error('blocked');
      },
      removeItem: function () {
        throw new Error('blocked');
      }
    };
  }

  function entry(name, score, lines, id, playedAt) {
    return G.createEntry(name, score, lines, id, playedAt);
  }

  test('STORAGE_KEY가 tetris-loop.leaderboard.v1이다', function () {
    assert(G.STORAGE_KEY === 'tetris-loop.leaderboard.v1', '실제 값: ' + G.STORAGE_KEY);
  });

  test('이름 길이 상수가 2와 10이다', function () {
    assert(G.NAME_MIN_LENGTH === 2, 'min: ' + G.NAME_MIN_LENGTH);
    assert(G.NAME_MAX_LENGTH === 10, 'max: ' + G.NAME_MAX_LENGTH);
    assert(G.LEADERBOARD_LIMIT === 10, 'limit: ' + G.LEADERBOARD_LIMIT);
  });

  test('validateName이 앞뒤 공백을 제거한다', function () {
    var result = G.validateName('  홍길동  ');
    assert(result.valid === true, '이유: ' + result.reason);
    assert(result.name === '홍길동', 'name: [' + result.name + ']');
  });

  test('빈 이름을 거부한다', function () {
    var result = G.validateName('   ');
    assert(result.valid === false, '통과되었다');
    assert(result.reason === '이름을 입력하세요.', 'reason: ' + result.reason);
  });

  test('1자 이름을 거부한다', function () {
    var result = G.validateName('가');
    assert(result.valid === false, '통과되었다');
    assert(result.reason === '이름은 2자 이상이어야 합니다.', 'reason: ' + result.reason);
  });

  test('11자 이름을 거부한다', function () {
    var result = G.validateName('abcdefghijk');
    assert(result.valid === false, '통과되었다');
    assert(result.reason === '이름은 10자 이하여야 합니다.', 'reason: ' + result.reason);
  });

  test('허용되지 않는 문자를 거부한다', function () {
    var bad = ['홍길동!', 'hong gil', 'a_b', '이름@'];
    for (var i = 0; i < bad.length; i++) {
      var result = G.validateName(bad[i]);
      assert(result.valid === false, bad[i] + '가 통과되었다');
      assert(result.reason === '이름에는 한글, 영문, 숫자만 쓸 수 있습니다.', bad[i] + ' reason: ' + result.reason);
    }
  });

  test('한글 완성형과 자모, 영문, 숫자를 통과시킨다', function () {
    var good = ['가나', 'ㅋㅋ', 'ㅏㅏ', 'Player1', 'abcdefghij', '홍길동123'];
    for (var i = 0; i < good.length; i++) {
      var result = G.validateName(good[i]);
      assert(result.valid === true, good[i] + ' 거부됨: ' + result.reason);
    }
  });

  test('createEntry가 다섯 필드를 가진 기록을 만든다', function () {
    var record = entry('가나', 100, 2, 'id-1', '2026-09-10T00:00:00.000Z');
    assert(record.id === 'id-1', 'id: ' + record.id);
    assert(record.name === '가나', 'name: ' + record.name);
    assert(record.score === 100, 'score: ' + record.score);
    assert(record.clearedLines === 2, 'clearedLines: ' + record.clearedLines);
    assert(record.playedAt === '2026-09-10T00:00:00.000Z', 'playedAt: ' + record.playedAt);
  });

  test('sortEntries가 점수 내림차순으로 정렬한다', function () {
    var sorted = G.sortEntries([
      entry('a', 100, 1, '1', '2026-01-01T00:00:00.000Z'),
      entry('b', 300, 1, '2', '2026-01-01T00:00:00.000Z'),
      entry('c', 200, 1, '3', '2026-01-01T00:00:00.000Z')
    ]);
    assert(sorted[0].score === 300, '1위: ' + sorted[0].score);
    assert(sorted[1].score === 200, '2위: ' + sorted[1].score);
    assert(sorted[2].score === 100, '3위: ' + sorted[2].score);
  });

  test('점수가 같으면 이름 오름차순으로 정렬한다', function () {
    var sorted = G.sortEntries([
      entry('c', 100, 1, '1', '2026-01-01T00:00:00.000Z'),
      entry('a', 100, 1, '2', '2026-01-01T00:00:00.000Z'),
      entry('b', 100, 1, '3', '2026-01-01T00:00:00.000Z')
    ]);
    assert(sorted[0].name === 'a', '1위: ' + sorted[0].name);
    assert(sorted[2].name === 'c', '3위: ' + sorted[2].name);
  });

  test('점수와 이름이 같으면 playedAt 오름차순으로 정렬한다', function () {
    var sorted = G.sortEntries([
      entry('a', 100, 1, 'late', '2026-05-01T00:00:00.000Z'),
      entry('a', 100, 1, 'early', '2026-01-01T00:00:00.000Z')
    ]);
    assert(sorted[0].id === 'early', '1위: ' + sorted[0].id);
  });

  test('세 기준이 같으면 기존 순서를 유지한다', function () {
    var stamp = '2026-01-01T00:00:00.000Z';
    var sorted = G.sortEntries([
      entry('a', 100, 1, 'first', stamp),
      entry('a', 100, 1, 'second', stamp),
      entry('a', 100, 1, 'third', stamp)
    ]);
    assert(sorted[0].id === 'first', '1위: ' + sorted[0].id);
    assert(sorted[1].id === 'second', '2위: ' + sorted[1].id);
    assert(sorted[2].id === 'third', '3위: ' + sorted[2].id);
  });

  test('sortEntries가 원본 배열을 바꾸지 않는다', function () {
    var original = [
      entry('a', 100, 1, '1', '2026-01-01T00:00:00.000Z'),
      entry('b', 300, 1, '2', '2026-01-01T00:00:00.000Z')
    ];
    G.sortEntries(original);
    assert(original[0].id === '1', '원본이 바뀌었다');
  });

  test('addEntry가 열 개까지만 남긴다', function () {
    var entries = [];
    for (var i = 0; i < 15; i++) {
      entries = G.addEntry(entries, entry('n' + i, i * 10, 1, 'id' + i, '2026-01-01T00:00:00.000Z'));
    }
    assert(entries.length === 10, '길이: ' + entries.length);
  });

  test('점수가 낮은 열한 번째 기록은 밀려난다', function () {
    var entries = [];
    for (var i = 1; i <= 10; i++) {
      entries = G.addEntry(entries, entry('n' + i, i * 100, 1, 'id' + i, '2026-01-01T00:00:00.000Z'));
    }
    var after = G.addEntry(entries, entry('low', 1, 1, 'low', '2026-01-01T00:00:00.000Z'));
    assert(after.length === 10, '길이: ' + after.length);
    for (var k = 0; k < after.length; k++) {
      assert(after[k].id !== 'low', '낮은 점수가 남아 있다');
    }
  });

  test('parseEntries가 JSON이 아닌 문자열에 빈 배열을 준다', function () {
    assert(G.parseEntries('{').length === 0, '비어 있지 않다');
    assert(G.parseEntries('보드').length === 0, '비어 있지 않다');
  });

  test('parseEntries가 배열이 아닌 JSON에 빈 배열을 준다', function () {
    assert(G.parseEntries('{"a":1}').length === 0, '비어 있지 않다');
    assert(G.parseEntries('null').length === 0, '비어 있지 않다');
  });

  test('parseEntries가 문자열이 아닌 입력에 빈 배열을 준다', function () {
    assert(G.parseEntries(null).length === 0, '비어 있지 않다');
    assert(G.parseEntries(undefined).length === 0, '비어 있지 않다');
  });

  test('parseEntries가 필드가 빠진 항목이 있으면 빈 배열을 준다', function () {
    assert(G.parseEntries('[{"id":"1"}]').length === 0, '비어 있지 않다');
    assert(G.parseEntries('[{"id":"1","name":"a","score":"100","clearedLines":1,"playedAt":"x"}]').length === 0,
      'score가 문자열인데 통과했다');
  });

  test('parseEntries가 정상 기록을 복원한다', function () {
    var text = JSON.stringify([entry('가나', 100, 2, 'id-1', '2026-01-01T00:00:00.000Z')]);
    var parsed = G.parseEntries(text);
    assert(parsed.length === 1, '길이: ' + parsed.length);
    assert(parsed[0].name === '가나', 'name: ' + parsed[0].name);
  });

  test('저장한 뒤 읽으면 같은 기록이 나온다', function () {
    var store = fakeStorage();
    var entries = [entry('가나', 100, 2, 'id-1', '2026-01-01T00:00:00.000Z')];
    assert(G.saveLeaderboard(store, entries) === true, '저장 실패');
    var loaded = G.loadLeaderboard(store);
    assert(loaded.length === 1, '길이: ' + loaded.length);
    assert(loaded[0].id === 'id-1', 'id: ' + loaded[0].id);
  });

  test('saveLeaderboard가 STORAGE_KEY에 쓴다', function () {
    var store = fakeStorage();
    G.saveLeaderboard(store, []);
    assert(store.lastKey === G.STORAGE_KEY, '쓴 키: ' + store.lastKey);
  });

  test('saveLeaderboard가 열 개까지만 쓴다', function () {
    var store = fakeStorage();
    var many = [];
    for (var i = 0; i < 15; i++) {
      many.push(entry('n' + i, i, 1, 'id' + i, '2026-01-01T00:00:00.000Z'));
    }
    G.saveLeaderboard(store, many);
    assert(G.loadLeaderboard(store).length === 10, '길이: ' + G.loadLeaderboard(store).length);
  });

  test('clearLeaderboard가 STORAGE_KEY를 지운다', function () {
    var store = fakeStorage(JSON.stringify([entry('가나', 1, 1, 'x', 'y')]));
    assert(G.clearLeaderboard(store) === true, '실패했다');
    assert(store.lastKey === G.STORAGE_KEY, '지운 키: ' + store.lastKey);
    assert(G.loadLeaderboard(store).length === 0, '남아 있다');
  });

  test('손상된 저장소 내용을 빈 목록으로 복구한다', function () {
    assert(G.loadLeaderboard(fakeStorage('망가진 데이터')).length === 0, '비어 있지 않다');
  });

  test('저장소가 막히면 읽기가 빈 배열을 준다', function () {
    assert(G.loadLeaderboard(throwingStorage()).length === 0, '예외가 새어 나왔다');
  });

  test('저장소가 막히면 쓰기가 false를 준다', function () {
    assert(G.saveLeaderboard(throwingStorage(), []) === false, 'true를 반환했다');
  });

  test('저장소가 막히면 초기화가 false를 준다', function () {
    assert(G.clearLeaderboard(throwingStorage()) === false, 'true를 반환했다');
  });

  test('리더보드가 게임 상태를 오염시키지 않는다', function () {
    var keys = Object.keys(G.createInitialState()).sort().join(',');
    assert(keys === 'board,lines,piece,randomizer,score,status', '필드: ' + keys);
  });

  // --- SPEC_05: 레벨과 낙하 속도 ---

  test('레벨과 속도 상수가 2, 700, 60, 100이다', function () {
    assert(G.LINES_PER_LEVEL === 2, 'LINES_PER_LEVEL: ' + G.LINES_PER_LEVEL);
    assert(G.BASE_DROP_INTERVAL_MS === 700, 'BASE: ' + G.BASE_DROP_INTERVAL_MS);
    assert(G.LEVEL_SPEED_STEP_MS === 60, 'STEP: ' + G.LEVEL_SPEED_STEP_MS);
    assert(G.MIN_DROP_INTERVAL_MS === 100, 'MIN: ' + G.MIN_DROP_INTERVAL_MS);
  });

  test('levelFor가 0줄과 1줄에서 1이다', function () {
    assert(G.levelFor(0) === 1, 'levelFor(0): ' + G.levelFor(0));
    assert(G.levelFor(1) === 1, 'levelFor(1): ' + G.levelFor(1));
  });

  test('levelFor가 두 줄마다 1씩 오른다', function () {
    var expected = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
    for (var lines = 0; lines < expected.length; lines++) {
      assert(G.levelFor(lines) === expected[lines],
        lines + '줄 -> ' + G.levelFor(lines) + ' (기대 ' + expected[lines] + ')');
    }
  });

  test('dropIntervalFor(1)이 700이다', function () {
    assert(G.dropIntervalFor(1) === 700, '실제 값: ' + G.dropIntervalFor(1));
  });

  test('dropIntervalFor가 레벨당 60씩 줄어든다', function () {
    var expected = [700, 640, 580, 520, 460, 400, 340, 280, 220, 160];
    for (var i = 0; i < expected.length; i++) {
      var level = i + 1;
      assert(G.dropIntervalFor(level) === expected[i],
        '레벨 ' + level + ' -> ' + G.dropIntervalFor(level) + ' (기대 ' + expected[i] + ')');
    }
  });

  test('dropIntervalFor가 100 아래로 내려가지 않는다', function () {
    var levels = [11, 12, 20, 50, 999];
    for (var i = 0; i < levels.length; i++) {
      assert(G.dropIntervalFor(levels[i]) === 100,
        '레벨 ' + levels[i] + ' -> ' + G.dropIntervalFor(levels[i]));
    }
  });

  test('레벨 1에서 한 줄 제거가 100점이다', function () {
    var landed = G.stepDown(placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 18, 8));
    assert(landed.lines === 1, 'lines: ' + landed.lines);
    assert(landed.score === 100, 'score: ' + landed.score);
  });

  test('레벨 2에서 한 줄 제거가 200점이다', function () {
    var state = placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 18, 8);
    state.lines = 2;
    var landed = G.stepDown(state);
    assert(G.levelFor(2) === 2, '레벨 계산이 다르다');
    assert(landed.score === 200, 'score: ' + landed.score);
  });

  test('레벨 2에서 네 줄 제거가 1600점이다', function () {
    var board = emptyBoard();
    for (var y = 16; y <= 19; y++) {
      fillRow(board, y, [9]);
    }
    var state = placed(board, 'I', 16, 7);
    state.lines = 2;
    state.piece.matrix = [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0]
    ];
    var landed = G.resolveLanding(state);
    assert(landed.lines === 6, 'lines: ' + landed.lines);
    assert(landed.score === 1600, 'score: ' + landed.score);
  });

  test('배수가 줄을 지우기 전 레벨로 계산된다', function () {
    var board = emptyBoard();
    fillRow(board, 19, [8, 9]);
    fillRow(board, 18, [8, 9]);
    var landed = G.stepDown(placed(board, 'O', 18, 8));
    assert(landed.lines === 2, 'lines: ' + landed.lines);
    assert(landed.score === 300, '지운 후 레벨로 계산되었다. score: ' + landed.score);
  });

  test('소프트 드롭 점수에 레벨 배수가 없다', function () {
    var state = placed(emptyBoard(), 'O', 0, 4);
    state.lines = 10;
    assert(G.levelFor(10) === 6, '레벨 계산이 다르다');
    for (var i = 0; i < 5; i++) {
      state = G.softDrop(state);
    }
    assert(state.score === 5, 'score: ' + state.score);
  });

  test('하드 드롭 점수에 레벨 배수가 없다', function () {
    var state = placed(emptyBoard(), 'O', 0, 4);
    state.lines = 10;
    var landed = G.hardDrop(state);
    assert(landed.score === 36, 'score: ' + landed.score);
  });

  test('레벨을 도입해도 상태 필드가 여섯 개다', function () {
    var keys = Object.keys(G.createInitialState()).sort().join(',');
    assert(keys === 'board,lines,piece,randomizer,score,status', '필드: ' + keys);
  });

  test('startGame 후 레벨이 1이다', function () {
    var scored = G.stepDown(placed(fillRow(emptyBoard(), 19, [8, 9]), 'O', 18, 8));
    var restarted = G.startGame(scored);
    assert(G.levelFor(restarted.lines) === 1, '레벨: ' + G.levelFor(restarted.lines));
    assert(G.dropIntervalFor(G.levelFor(restarted.lines)) === 700, '간격이 700이 아니다');
  });

  // --- 결과 출력 ---

  var passed = 0;
  var failed = 0;
  var list = document.getElementById('results');

  for (var i = 0; i < results.length; i++) {
    var item = results[i];
    var li = document.createElement('li');
    if (item.ok) {
      passed++;
      li.className = 'test-pass';
      li.textContent = 'PASS  ' + item.name;
    } else {
      failed++;
      li.className = 'test-fail';
      li.textContent = 'FAIL  ' + item.name + ' — ' + item.reason;
    }
    list.appendChild(li);
  }

  var summary = document.getElementById('summary');
  summary.textContent = passed + ' 통과 / ' + failed + ' 실패 (전체 ' + results.length + ')';
  summary.className = 'test-summary ' + (failed === 0 ? 'test-pass' : 'test-fail');
})();
