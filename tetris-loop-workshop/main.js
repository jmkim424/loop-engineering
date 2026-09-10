(function () {
  'use strict';

  var game = globalThis.TetrisGame;

  var FLICKER_BASE_MS = 2400;
  var FLICKER_STEP_MS = 200;
  var FLICKER_MIN_MS = 400;

  var CLEAR_CONFIRM_TEXT = '저장된 기록을 모두 지울까요?';

  var timerId = null;
  var currentInterval = null;
  var cellElements = [];
  var savedThisGame = false;

  function freshState() {
    var injected = globalThis.TETRIS_RANDOMIZER;
    if (typeof injected === 'function') {
      return game.createInitialState({ randomizer: injected });
    }
    return game.createInitialState();
  }

  var state = freshState();

  function el(id) {
    return document.getElementById(id);
  }

  function storage() {
    return globalThis.localStorage;
  }

  function currentLevel() {
    return game.levelFor(state.lines);
  }

  function buildBoard(boardEl) {
    for (var y = 0; y < game.BOARD_HEIGHT; y++) {
      for (var x = 0; x < game.BOARD_WIDTH; x++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(y);
        cell.dataset.col = String(x);
        boardEl.appendChild(cell);
        cellElements.push(cell);
      }
    }
  }

  function flickerPeriodMs(lines) {
    var period = FLICKER_BASE_MS - lines * FLICKER_STEP_MS;
    return period < FLICKER_MIN_MS ? FLICKER_MIN_MS : period;
  }

  function renderTitle() {
    var title = document.querySelector('.title');
    title.style.setProperty('--flicker-period', flickerPeriodMs(state.lines) + 'ms');
    if (state.status === game.GAME_STATUS.PLAYING && state.piece !== null) {
      title.classList.add('is-flickering');
    } else {
      title.classList.remove('is-flickering');
    }
  }

  function renderLeaderboard() {
    var entries = game.loadLeaderboard(storage());
    var list = el('leaderboard-list');
    list.textContent = '';
    for (var i = 0; i < entries.length; i++) {
      var item = document.createElement('li');
      item.textContent = entries[i].name + ' · ' + entries[i].score + '점 · ' + entries[i].clearedLines + '줄';
      list.appendChild(item);
    }
    list.hidden = entries.length === 0;
    el('leaderboard-empty').hidden = entries.length > 0;
  }

  function renderGameOverPanel() {
    var isOver = state.status === game.GAME_STATUS.GAME_OVER;
    el('gameover-panel').hidden = !isOver;
    if (!isOver) {
      return;
    }
    el('final-score').textContent = String(state.score);
    el('final-lines').textContent = String(state.lines);
    renderLeaderboard();
  }

  function render() {
    var view = game.toRenderBoard(state);
    for (var y = 0; y < game.BOARD_HEIGHT; y++) {
      for (var x = 0; x < game.BOARD_WIDTH; x++) {
        var value = view[y][x];
        var element = cellElements[y * game.BOARD_WIDTH + x];
        element.className = value === 0 ? 'cell' : 'cell cell-' + value;
      }
    }
    el('score-value').textContent = String(state.score);
    el('lines-value').textContent = String(state.lines);
    el('level-value').textContent = String(currentLevel());
    el('status-value').textContent = state.status;
    renderTitle();
    renderGameOverPanel();
  }

  function isPlaying() {
    return state.status === game.GAME_STATUS.PLAYING;
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    currentInterval = null;
  }

  // 목표 간격이 실제로 달라졌을 때만 타이머를 다시 건다.
  // 상태가 바뀔 때마다 무조건 다시 걸면 방향키 연타로 낙하를 무한히 미룰 수 있다.
  function syncTimer() {
    if (!isPlaying()) {
      stopTimer();
      return;
    }
    var wanted = game.dropIntervalFor(currentLevel());
    if (timerId !== null && currentInterval === wanted) {
      return;
    }
    if (timerId !== null) {
      clearInterval(timerId);
    }
    currentInterval = wanted;
    timerId = setInterval(onTick, wanted);
  }

  function onTick() {
    if (!isPlaying()) {
      stopTimer();
      return;
    }
    state = game.stepDown(state);
    syncTimer();
    render();
  }

  function onStartClick() {
    stopTimer();
    savedThisGame = false;
    el('name-input').disabled = false;
    el('name-input').value = '';
    el('save-button').disabled = false;
    el('save-message').textContent = '';
    state = game.startGame(freshState());
    syncTimer();
    render();
  }

  function onSaveSubmit(event) {
    event.preventDefault();
    var message = el('save-message');

    if (savedThisGame) {
      message.textContent = '이 게임은 이미 저장했습니다.';
      return;
    }

    var checked = game.validateName(el('name-input').value);
    if (!checked.valid) {
      message.textContent = checked.reason;
      return;
    }

    var entry = game.createEntry(
      checked.name,
      state.score,
      state.lines,
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      new Date().toISOString()
    );
    var entries = game.addEntry(game.loadLeaderboard(storage()), entry);

    if (!game.saveLeaderboard(storage(), entries)) {
      message.textContent = '기록을 저장할 수 없습니다.';
      return;
    }

    savedThisGame = true;
    el('name-input').disabled = true;
    el('save-button').disabled = true;
    message.textContent = '저장했습니다.';
    renderLeaderboard();
  }

  function onClearClick() {
    if (!globalThis.confirm(CLEAR_CONFIRM_TEXT)) {
      return;
    }
    game.clearLeaderboard(storage());
    renderLeaderboard();
  }

  function isSpaceKey(key) {
    return key === ' ' || key === 'Spacebar';
  }

  function onKeyDown(event) {
    if (!isPlaying()) {
      return;
    }

    var handled = true;
    if (event.key === 'ArrowLeft') {
      state = game.movePiece(state, -1, 0);
    } else if (event.key === 'ArrowRight') {
      state = game.movePiece(state, 1, 0);
    } else if (event.key === 'ArrowDown') {
      state = game.softDrop(state);
    } else if (event.key === 'ArrowUp') {
      state = game.rotatePiece(state);
    } else if (isSpaceKey(event.key)) {
      state = game.hardDrop(state);
    } else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
      syncTimer();
      render();
    }
  }

  buildBoard(el('board'));
  render();
  el('start-button').addEventListener('click', onStartClick);
  el('save-form').addEventListener('submit', onSaveSubmit);
  el('clear-button').addEventListener('click', onClearClick);
  document.addEventListener('keydown', onKeyDown);
})();
