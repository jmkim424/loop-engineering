---
description: SPEC 한 장을 실행하고 검증하고 보고하고 MEMORY.md를 갱신한다
argument-hint: <SPEC 파일명 (생략 시 MEMORY.md의 활성 SPEC)>
---

# /spec-run — SPEC 실행 루프 1회

대상 SPEC: **$ARGUMENTS** (비어 있으면 `MEMORY.md`의 `현재 상태 > 활성 SPEC`을 쓴다)

이 커맨드는 **한 회차**만 돈다. 완료하지 못해도 회차를 늘려 스스로 다시 돌지 않는다.
사용자가 다시 호출한다.

아래 7단계를 순서대로, 건너뛰지 말고 실행한다.

---

## 1단계 — 읽기

이 순서로 읽는다.

1. `MEMORY.md` — 특히 `반복된 실패`, `완료 조건 현황`, `사람 확인 기록`, `다음 실행이 할 일`
2. 대상 SPEC 전체
3. `CLAUDE.md` (이미 로드되어 있으면 생략)

**사용자가 이번 프롬프트에서 브라우저 확인 결과를 전달했다면 지금 확보해 둔다.**
7단계에서 `사람 확인 기록`에 원문 그대로 옮겨 적어야 한다.

`반복된 실패` 표에 이미 있는 수정 방법은 **다시 시도하지 않는다**. 같은 방법을 반복하는 것이
이 루프가 실패하는 가장 흔한 이유다.

## 2단계 — 회차 확인

- `MEMORY.md`의 현재 회차 `n`과 SPEC frontmatter의 `max_iterations`를 비교한다.
- `n >= max_iterations` 이면 **구현하지 않고** 정지 조건 (a)로 즉시 6단계·7단계로 간다.
- `반복된 실패` 표에 횟수 2 이상인 시그니처가 있으면 정지 조건 (b)로 즉시 6단계·7단계로 간다.
- 진행 가능하면 이번 실행이 회차 `n+1`임을 기억한다.

## 3단계 — 계획

- `완료 조건 현황`에서 `미확인` 또는 `실패`인 항목만 이번 회차의 대상이다.
- 이미 `통과(AUTO)` / `통과(HUMAN)`인 항목을 만족시키는 코드는 **건드리지 않는다**.
- 무엇을 어떤 파일에서 고칠지 짧게 적는다. 최소 diff를 목표로 한다.
- 계획 중에 SPEC에 없는 결정이 필요해지면 정지 조건 (c)다. 임시값을 넣지 말고 6단계로 간다.

## 4단계 — 구현

- 쓰기 대상은 `tetris-loop-workshop/` 안뿐이다.
- SPEC이 명시한 파일 외에 새 파일을 만들지 않는다.
- 기존에 통과한 동작을 깨뜨리는 리팩터링을 하지 않는다.

## 5단계 — 자동 검증

아래를 **실제로 실행**한다. 명령과 그 출력을 6단계 보고서에 그대로 붙인다.
출력을 인용하지 못하는 항목은 `AUTO` 근거가 되지 않는다.

작업 디렉터리는 `C:\my_program\Loop-Engineering` 기준이다.

### 5-1. 파일 인벤토리

```bash
ls -1 tetris-loop-workshop
```

SPEC이 명시한 파일 집합과 정확히 일치해야 한다. 파일이 더 있으면 **실패**로 기록한다.

### 5-2. 로드 순서와 defer

```bash
grep -n -E 'style\.css|game\.js|main\.js|test\.js' tetris-loop-workshop/index.html
grep -c 'defer' tetris-loop-workshop/index.html
grep -n -E 'game\.js|test\.js' tetris-loop-workshop/test.html
```

판정 기준

- `index.html`: `style.css` → `game.js` → `main.js` 순으로 줄 번호가 증가한다.
- `index.html`: `defer` 개수가 2다. `test.js`는 `index.html`에 없어야 한다.
- `test.html`: `game.js`가 `test.js`보다 먼저 온다.

### 5-3. 금지 토큰

```bash
grep -n -E "import |export |require\(|module\.exports|<script src=\"http|<link[^>]*href=\"http|node_modules|package\.json|fetch\(|XMLHttpRequest" tetris-loop-workshop/*.html tetris-loop-workshop/*.js
```

출력이 **비어 있어야** 통과다. 한 줄이라도 나오면 기술 제약 위반이다.

### 5-4. 문법 검사

```bash
node --check tetris-loop-workshop/game.js
node --check tetris-loop-workshop/main.js
node --check tetris-loop-workshop/test.js
```

### 5-5. `game.js` 계약 검사

아래 스크립트를 **스크래치패드에** 저장하고 실행한다. 프로젝트 폴더에 남기지 않는다.

```js
// contract-check.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = process.argv[2];
let pass = 0, fail = 0;
function check(name, fn) {
  let r;
  try { r = fn(); } catch (e) { r = e.message; }
  if (r === true) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + ' -> ' + r); }
}

const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const sandbox = vm.createContext({ console });
vm.runInContext(src, sandbox, { filename: 'game.js' });
const G = vm.runInContext('globalThis.TetrisGame', sandbox);

check('TetrisGame 공개', () => (G && typeof G === 'object') || 'globalThis.TetrisGame 없음');
check('BOARD_WIDTH === 10', () => G.BOARD_WIDTH === 10 || 'got ' + G.BOARD_WIDTH);
check('BOARD_HEIGHT === 20', () => G.BOARD_HEIGHT === 20 || 'got ' + G.BOARD_HEIGHT);
check('GAME_STATUS 5개 값', () => {
  const need = ['READY', 'PLAYING', 'LANDED', 'PAUSED', 'GAME_OVER'];
  const miss = need.filter(k => !G.GAME_STATUS || G.GAME_STATUS[k] !== k);
  return miss.length === 0 || '누락/불일치: ' + miss.join(',');
});
check('createEmptyBoard 함수', () => typeof G.createEmptyBoard === 'function' || 'not a function');
check('빈 보드 20행', () => G.createEmptyBoard().length === 20 || 'got ' + G.createEmptyBoard().length);
check('각 행 10셀', () => {
  const b = G.createEmptyBoard();
  const bad = b.findIndex(r => !Array.isArray(r) || r.length !== 10);
  return bad === -1 || 'row ' + bad;
});
check('모든 셀 0', () => {
  const b = G.createEmptyBoard();
  const bad = b.findIndex(r => r.some(c => c !== 0));
  return bad === -1 || 'row ' + bad;
});
check('같은 보드의 행끼리 비공유', () => {
  const b = G.createEmptyBoard();
  b[0][0] = 9;
  return b[1][0] === 0 || '행 배열 공유됨';
});
check('두 보드가 행 배열 비공유', () => {
  const a = G.createEmptyBoard(), b = G.createEmptyBoard();
  a[0][0] = 9;
  return (a[0] !== b[0] && b[0][0] === 0) || '보드 간 행 공유됨';
});
check('createInitialState 함수', () => typeof G.createInitialState === 'function' || 'not a function');
check('초기 상태: 보드 20x10', () => {
  const s = G.createInitialState();
  const k = Object.keys(s).find(k => Array.isArray(s[k]) && s[k].length === 20);
  return (k && s[k].every(r => r.length === 10)) || '20x10 보드 필드 없음';
});
check('초기 상태: 0인 필드 2개 (점수/줄)', () => {
  const s = G.createInitialState();
  const z = Object.keys(s).filter(k => s[k] === 0);
  return z.length >= 2 || '0인 필드: ' + JSON.stringify(z);
});
check("초기 상태: READY 필드", () => {
  const s = G.createInitialState();
  const r = Object.keys(s).filter(k => s[k] === 'READY');
  return r.length >= 1 || "'READY'인 필드 없음";
});

console.log('KEYS ' + JSON.stringify(Object.keys(G.createInitialState())));
console.log('SUMMARY pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
```

실행:

```bash
node "<스크래치패드>/contract-check.cjs" "C:/my_program/Loop-Engineering/tetris-loop-workshop"
```

마지막 `KEYS` 줄에 나온 상태 필드 이름을 `MEMORY.md`의 `확정된 계약`에 기록한다.
SPEC은 필드 이름을 지정하지 않으므로, **한 번 정한 이름을 이후 회차에서 바꾸지 않는다.**

### 5-6. 자동으로 확인할 수 없는 것

다음은 `AUTO`가 될 수 없다. 코드를 근거로 통과 판정하지 않는다.
`미확인 — 사람 확인 대기`로 둔다.

- 브라우저 콘솔 오류 없음
- `test.html`의 실제 화면 결과
- 렌더링된 셀 개수·텍스트·레이아웃
- 390px 가로 스크롤 없음
- 5초 대기·키 입력 후 무변화

## 6단계 — 보고

다음 형식으로 출력한다.

### 6-1. 헤더

```
SPEC: <파일명>   회차: n/max   결과: 진행중 | 정지(사유) | 조건 충족 대기
```

### 6-2. 완료 조건 표

SPEC §6의 모든 항목을 **하나도 빼지 않고** 표로 만든다.

| # | 완료 조건 | 수단 | 상태 | 근거 |
| - | --------- | ---- | ---- | ---- |

- 수단: `AUTO` / `HUMAN`
- 상태: `통과` / `실패` / `미확인`
- 근거: AUTO면 5단계 명령 이름과 결과, HUMAN이면 `MEMORY.md` 사람 확인 기록의 날짜.
  근거가 없으면 `-`이고 상태는 반드시 `미확인`이다.

### 6-3. 검증 출력 원문

5-1 ~ 5-5의 명령과 출력을 그대로 붙인다. 요약하지 않는다.

### 6-4. 변경한 파일

경로와 한 줄 요약.

### 6-5. 사람이 확인해야 할 것

SPEC §8을 그대로 옮기고, 복사해서 답장할 수 있는 형태로 낸다.

```
아래를 확인하시고 결과를 프롬프트로 알려 주세요.
1. index.html을 브라우저에서 열고 콘솔 오류 여부 →
2. test.html을 열고 통과/실패 개수 →
3. 폭 390px에서 가로 스크롤 여부 →
4. 5초 대기·방향키 입력 후 변화 여부 →
```

### 6-6. `[사람 확인 필요]`

SPEC에 없어서 결정할 수 없었던 항목. 없으면 "없음".

### 6-7. 완료 선언

`CLAUDE.md` §4를 따른다. 전 항목이 `통과`일 때만 완료라고 쓴다.
아니면 `미확인 n건, 실패 m건 — 완료 아님`이라고 명시한다.

## 7단계 — MEMORY.md 갱신

`MEMORY.md`를 아래대로 갱신한다. 섹션을 지우거나 순서를 바꾸지 않는다.

- `현재 상태` — 활성 SPEC, 회차 `n/max`, 상태, 오늘 날짜.
- `파일 인벤토리` — 5-1 출력 기준으로 갱신.
- `확정된 계약` — 5-5의 `KEYS`와 공개 함수 시그니처. 이미 있으면 바꾸지 않는다.
- `완료 조건 현황` — 6-2 표와 **동일한 내용**. 보고서와 MEMORY가 어긋나면 안 된다.
- `사람 확인 기록` — 사용자가 이번 프롬프트에서 전달한 확인 결과를
  `[YYYY-MM-DD] (사람) <원문>` 형식으로 **추가**한다. 기존 줄을 지우지 않는다.
  에이전트가 관찰한 것을 이 섹션에 쓰지 않는다.
- `반복된 실패` — 이번에 실패한 항목의 시그니처를 찾아 횟수를 올리거나 새로 추가한다.
  시도한 수정과 결과를 함께 적는다.
- `열린 질문 [사람 확인 필요]` — 6-6과 동기화.
- `다음 실행이 할 일` — 다음 회차가 손댈 항목을 구체적으로. 정지했으면 무엇을 사람에게
  받아야 재개 가능한지 적는다.

`MEMORY.md`는 이 커맨드만 쓴다. 사용자는 직접 편집하지 않고 프롬프트로 알려 주며,
그 내용을 에이전트가 위 규칙대로 옮겨 적는다.
