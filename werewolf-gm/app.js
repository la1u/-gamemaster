/* ========================================
   人狼GMアシスタント — app.js
   ======================================== */

// ===== 定数 =====
const ROLES = {
  VILLAGER: '村人',
  WEREWOLF: '人狼',
  SEER:     '占い師',
  MEDIUM:   '霊能者',
  HUNTER:   '狩人'
};

const ROLE_CSS = {
  [ROLES.VILLAGER]: 'villager-tag',
  [ROLES.WEREWOLF]: 'werewolf-tag',
  [ROLES.SEER]:     'seer-tag',
  [ROLES.MEDIUM]:   'medium-tag',
  [ROLES.HUNTER]:   'hunter-tag'
};

const ROLE_POOL = [
  ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER,
  ROLES.WEREWOLF, ROLES.WEREWOLF,
  ROLES.SEER,
  ROLES.MEDIUM,
  ROLES.HUNTER
];

const NUM_PLAYERS = 8;
const TIMER_MINUTES = 6;

// ===== ゲーム状態 =====
let players = [];
let day = 1;
let phase = 'night';
let stepIndex = 0;
let currentSteps = [];
let lastGuarded = null;
let nightKillTarget = null;
let nightGuardTarget = null;
let lastExecuted = null;
let randomWhiteTarget = null;
let isStarting = false;

// ===== タイマー =====
let timerInterval = null;
let timerSeconds = TIMER_MINUTES * 60;
let timerRunning = false;

// ===== 初期化 =====
(function initSetup() {
  const container = document.getElementById('player-inputs');
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'player-input-wrap';
    wrap.innerHTML = `
      <input type="text" id="pname-${i}" placeholder="プレイヤー${i + 1} の名前" maxlength="12" />
      <select id="prole-${i}" class="role-select">
        <option value="ランダム">ランダム</option>
        <option value="${ROLES.VILLAGER}">${ROLES.VILLAGER}</option>
        <option value="${ROLES.WEREWOLF}">${ROLES.WEREWOLF}</option>
        <option value="${ROLES.SEER}">${ROLES.SEER}</option>
        <option value="${ROLES.MEDIUM}">${ROLES.MEDIUM}</option>
        <option value="${ROLES.HUNTER}">${ROLES.HUNTER}</option>
      </select>
    `;
    container.appendChild(wrap);
  }
  document.getElementById('btn-start').addEventListener('click', startGame);
})();

// ===== ユーティリティ =====
function showError(msg) {
  const el = document.getElementById('setup-error');
  if (msg) {
    el.innerHTML = msg.replace(/\n/g, '<br>');
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAlive() { return players.filter(p => p.alive); }
function getAliveWolves() { return getAlive().filter(p => p.role === ROLES.WEREWOLF); }
function getAliveVillagers() { return getAlive().filter(p => p.role !== ROLES.WEREWOLF); }
function getPlayerById(id) { return players.find(p => p.id === id); }
function getSeer() { return players.find(p => p.role === ROLES.SEER); }
function getHunter() { return players.find(p => p.role === ROLES.HUNTER); }
function getMedium() { return players.find(p => p.role === ROLES.MEDIUM); }
function getWolves() { return players.filter(p => p.role === ROLES.WEREWOLF); }

// ===== ゲーム開始 =====
function startGame() {
  if (isStarting) return;
  isStarting = true;
  showError('');

  try {
    const names = [];
    const manualRoles = [];
    
    // 設定されるべき役職の上限
    const baseCounts = {
      [ROLES.VILLAGER]: 3,
      [ROLES.WEREWOLF]: 2,
      [ROLES.SEER]: 1,
      [ROLES.MEDIUM]: 1,
      [ROLES.HUNTER]: 1
    };

    for (let i = 0; i < NUM_PLAYERS; i++) {
      const input = document.getElementById(`pname-${i}`);
      const select = document.getElementById(`prole-${i}`);
      const val = input.value.trim();
      const roleVal = select.value;
      
      if (!val) {
        showError(`プレイヤー${i + 1} の名前を入力してください。`);
        input.focus();
        return;
      }
      if (names.includes(val)) {
        showError(`「${val}」が重複しています。\n全員異なる名前にしてください。`);
        return;
      }
      names.push(val);
      manualRoles.push(roleVal);
    }

    // 役職の数え上げとバリデーション
    const currentCounts = { [ROLES.VILLAGER]: 0, [ROLES.WEREWOLF]: 0, [ROLES.SEER]: 0, [ROLES.MEDIUM]: 0, [ROLES.HUNTER]: 0 };
    for (const r of manualRoles) {
      if (r !== 'ランダム') currentCounts[r]++;
    }

    for (const r in baseCounts) {
      if (currentCounts[r] > baseCounts[r]) {
        showError(`役職「${r}」の指定数が多すぎます。\n上限（${baseCounts[r]}名）を超えないように設定してください。`);
        return;
      }
    }

    // ランダム枠に割り当てる役職のリストを準備
    const remainingRoles = [];
    for (const r in baseCounts) {
      const remainingCount = baseCounts[r] - currentCounts[r];
      for (let i = 0; i < remainingCount; i++) remainingRoles.push(r);
    }
    const shuffledRemaining = shuffle(remainingRoles);

    // プレイヤーへの割り当て
    players = names.map((name, i) => {
      let finalRole = manualRoles[i];
      if (finalRole === 'ランダム') {
        finalRole = shuffledRemaining.pop();
      }
      return { id: i, name, role: finalRole, alive: true, causeOfDeath: null };
    });

    const villageSide = players.filter(p => p.role !== ROLES.WEREWOLF && p.role !== ROLES.SEER);
    randomWhiteTarget = villageSide[Math.floor(Math.random() * villageSide.length)];

    day = 1;
    phase = 'night';
    stepIndex = 0;
    lastGuarded = null;
    lastExecuted = null;
    nightKillTarget = null;
    nightGuardTarget = null;

    switchScreen('game-screen');
    document.body.classList.add('night');
    document.body.classList.remove('day');

    buildNightPhase();
    renderSidePanel();
    renderStep();
  } finally {
    isStarting = false;
  }
}

// ===== 画面切り替え =====
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active');
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
}

// ===== タイマー機能 =====
function showTimer() {
  document.getElementById('timer-area').style.display = '';
  timerSeconds = TIMER_MINUTES * 60;
  timerRunning = false;
  clearInterval(timerInterval);
  updateTimerDisplay();
  document.getElementById('btn-timer-start').textContent = '▶ スタート';
}

function hideTimer() {
  document.getElementById('timer-area').style.display = 'none';
  clearInterval(timerInterval);
  timerRunning = false;
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('btn-timer-start').textContent = '▶ 再開';
  } else {
    timerRunning = true;
    document.getElementById('btn-timer-start').textContent = '⏸ 一時停止';
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        clearInterval(timerInterval);
        timerRunning = false;
        document.getElementById('btn-timer-start').textContent = '▶ スタート';
      }
      updateTimerDisplay();
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = TIMER_MINUTES * 60;
  updateTimerDisplay();
  document.getElementById('btn-timer-start').textContent = '▶ スタート';
}

function updateTimerDisplay() {
  const min = Math.floor(timerSeconds / 60);
  const sec = timerSeconds % 60;
  const display = document.getElementById('timer-display');
  display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  display.classList.remove('warning', 'danger');
  if (timerSeconds <= 30) {
    display.classList.add('danger');
  } else if (timerSeconds <= 60) {
    display.classList.add('warning');
  }
}

// ===== フェーズ構築 =====
function buildNightPhase() {
  currentSteps = [];
  phase = 'night';

  if (day === 1) {
    /* === 1日目夜: 配役確認 === */
    currentSteps.push({ text: '目を閉じてください。\nこれから役職確認をします。' });

    // ① 人狼
    const wolves = getWolves();
    const wolfNames = wolves.map(w => w.name).join('、');
    currentSteps.push({
      text: '人狼は目を開けてください。\nお互いを確認してください。',
      note: `（人狼: ${wolfNames}）`
    });
    currentSteps.push({ text: '目を閉じてください。' });

    // ② 占い師
    const seer = getSeer();
    currentSteps.push({
      text: '占い師は目を開けてください。',
      note: `（占い師: ${seer ? seer.name : '—'}）`
    });
    currentSteps.push({
      text: `<span class="result-white">${randomWhiteTarget.name} ＝ 白</span>\n<span class="warn">（初日ランダム白）</span>\n\n確認したら目を閉じてください。`
    });

    // ③ 狩人
    const hunter = getHunter();
    currentSteps.push({
      text: '狩人は目を開けてください。',
      note: `（狩人: ${hunter ? hunter.name : '—'}）`
    });
    currentSteps.push({ text: '目を閉じてください。' });

    // ④ 霊能者
    const medium = getMedium();
    currentSteps.push({
      text: '霊能者は目を開けてください。',
      note: `（霊能者: ${medium ? medium.name : '—'}）`
    });
    currentSteps.push({ text: '目を閉じてください。' });

    // → 昼へ
    currentSteps.push({
      text: '',
      transition: true, action: 'TO_DAY'
    });

  } else {
    /* === 2日目以降の夜 === */
    // メッセージが二重表示されるのを防ぐため、ここは削除済

    // ① 人狼
    if (getAliveWolves().length > 0) {
      currentSteps.push({
        text: '人狼は目を開けてください。\n噛む人を指差してください。',
        action: 'WOLF_KILL'
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ② 狩人
    const hunter = getHunter();
    if (hunter && hunter.alive) {
      currentSteps.push({
        text: '狩人は目を開けてください。\n守る人を指差してください。\n<span class="warn">※同じ人を連続護衛できません</span>',
        action: 'GUARD'
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ③ 占い師
    const seer = getSeer();
    if (seer && seer.alive) {
      currentSteps.push({
        text: '占い師は目を開けてください。\n占う人を指差してください。',
        action: 'SEER'
      });
      // 占い結果は選択後に動的挿入
    }

    // ④ 霊能者
    const medium = getMedium();
    if (medium && medium.alive && lastExecuted) {
      const exTarget = getPlayerById(lastExecuted);
      if (exTarget) {
        const isWolf = exTarget.role === ROLES.WEREWOLF;
        const resultClass = isWolf ? 'result-black' : 'result-white';
        const resultText = isWolf ? '黒' : '白';
        currentSteps.push({
          text: '霊能者は目を開けてください。',
          note: `（霊能者: ${medium.name}）`
        });
        currentSteps.push({
          text: `処刑された <span class="${resultClass}">${exTarget.name} ＝ ${resultText}</span>\n\n確認したら目を閉じてください。`
        });
      }
    }

    // → 朝へ（夜解決して直接昼へ）
    currentSteps.push({
      text: '',
      transition: true, action: 'RESOLVE_NIGHT'
    });
  }

  stepIndex = 0;
  updatePhaseHeader();
}

function buildDayPhase() {
  currentSteps = [];
  phase = 'day';

  if (day === 1) {
    // 1日目: 死者なし → 議論
    currentSteps.push({
      text: '朝になりました。\n全員、目を開けてください。\n\n議論を始めてください。',
      showTimer: true
    });
  } else {
    // 朝の死亡発表
    if (nightKillTarget && nightKillTarget !== '__guarded__') {
      const p = getPlayerById(nightKillTarget);
      currentSteps.push({
        text: `朝になりました。\n全員、目を開けてください。\n\n昨夜、死亡した人は<span class="highlight">${p.name}</span>さんです。`
      });
    } else {
      currentSteps.push({
        text: '朝になりました。\n全員、目を開けてください。\n\n昨夜、死亡した人はいませんでした。'
      });
    }

    // 死亡発表後に勝利判定
    if (isGameOver()) {
      currentSteps.push({
        text: '勝敗が決定しました。結果は...',
        action: 'SHOW_RESULT'
      });
      stepIndex = 0;
      nightKillTarget = null;
      nightGuardTarget = null;
      updatePhaseHeader();
      return;
    }

    // 議論
    currentSteps.push({
      text: '議論を始めてください。',
      showTimer: true
    });
  }

  // 投票
  currentSteps.push({
    text: '投票の時間です。\nせーので指を差してください。',
    action: 'VOTE'
  });

  stepIndex = 0;
  nightKillTarget = null;
  nightGuardTarget = null;
  updatePhaseHeader();
}

// ===== 勝利判定ヘルパー =====
function isGameOver() {
  const aliveWolves = getAliveWolves().length;
  const aliveVillagers = getAliveVillagers().length;
  return aliveWolves === 0 || aliveWolves >= aliveVillagers;
}

function getWinner() {
  return getAliveWolves().length === 0 ? 'village' : 'werewolf';
}

// ===== フェーズヘッダー更新 =====
function updatePhaseHeader() {
  const icon = document.getElementById('phase-icon');
  const title = document.getElementById('phase-title');
  const sub = document.getElementById('phase-sub');

  if (phase === 'night') {
    icon.textContent = '🌙';
    title.textContent = `${day}日目 夜`;
    sub.textContent = day === 1 ? '配役確認' : '人狼の時間';
    document.body.classList.add('night');
    document.body.classList.remove('day');
  } else {
    icon.textContent = '🌅';
    title.textContent = `${day}日目 昼`;
    sub.textContent = '議論・投票';
    document.body.classList.add('day');
    document.body.classList.remove('night');
  }

  const header = document.getElementById('phase-header');
  header.style.animation = 'none';
  header.offsetHeight;
  header.style.animation = 'fadeInDown .5s ease';
}

// ===== ステップ描画 =====
function renderStep() {
  if (stepIndex < 0) stepIndex = 0;
  if (stepIndex >= currentSteps.length) return;

  const step = currentSteps[stepIndex];
  const scriptText = document.getElementById('script-text');
  const actionArea = document.getElementById('action-area');
  const scriptCard = document.getElementById('script-card');

  scriptCard.style.animation = 'none';
  scriptCard.offsetHeight;
  scriptCard.style.animation = 'fadeIn .4s ease';

  let html = step.text;
  if (step.note) {
    html += `\n\n<span class="warn">${step.note}</span>`;
  }
  scriptText.innerHTML = html;
  scriptCard.style.display = html ? 'flex' : 'none';

  // タイマー表示制御
  if (step.showTimer) {
    showTimer();
  } else {
    hideTimer();
  }

  // アクションUI
  const selectActions = ['WOLF_KILL', 'GUARD', 'SEER', 'VOTE'];
  const needsSelection = step.action && selectActions.includes(step.action) && !step.actionDone;

  if (needsSelection) {
    showActionUI(step.action);
  } else {
    actionArea.style.display = 'none';
  }

  // ボタン制御
  document.getElementById('btn-prev').style.display = stepIndex > 0 ? '' : 'none';

  const nextBtn = document.getElementById('btn-next');
  if (step.transition) {
    nextBtn.textContent = phase === 'night' ? '☀️ 昼へ進む' : '🌙 夜へ進む';
    nextBtn.disabled = false;
  } else if (step.action === 'SHOW_RESULT') {
    nextBtn.textContent = '結果を見る 🎉';
    nextBtn.disabled = false;
  } else if (needsSelection) {
    nextBtn.textContent = '選択してください';
    nextBtn.disabled = true;
  } else {
    nextBtn.textContent = '次へ →';
    nextBtn.disabled = false;
  }
}

// ===== アクションUI =====
function showActionUI(action) {
  const area = document.getElementById('action-area');
  const grid = document.getElementById('player-select-grid');
  const title = document.getElementById('action-title');
  area.style.display = '';
  grid.innerHTML = '';

  let candidates = [];

  switch (action) {
    case 'WOLF_KILL':
      title.textContent = '🐺 噛む対象を選んでください';
      candidates = getAlive().filter(p => p.role !== ROLES.WEREWOLF);
      break;
    case 'GUARD':
      title.textContent = '🛡️ 守る対象を選んでください';
      candidates = getAlive().filter(p => p.role !== ROLES.HUNTER);
      break;
    case 'SEER':
      title.textContent = '🔮 占う対象を選んでください';
      candidates = getAlive().filter(p => p.role !== ROLES.SEER);
      break;
    case 'VOTE':
      title.textContent = '⚖️ 処刑する人を選んでください（最多票）';
      candidates = getAlive();
      break;
    default:
      area.style.display = 'none';
      return;
  }

  candidates.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'player-select-btn';
    btn.textContent = p.name;
    btn.dataset.playerId = p.id;

    if (action === 'GUARD' && lastGuarded === p.id) {
      btn.classList.add('disabled');
      btn.title = '連続護衛禁止';
    }

    btn.onclick = () => selectTarget(action, p.id);
    grid.appendChild(btn);
  });
}

// ===== 対象選択 =====
function selectTarget(action, playerId) {
  const grid = document.getElementById('player-select-grid');
  grid.querySelectorAll('.player-select-btn').forEach(b => b.classList.remove('selected'));
  const selectedBtn = grid.querySelector(`[data-player-id="${playerId}"]`);
  if (selectedBtn) selectedBtn.classList.add('selected');

  const step = currentSteps[stepIndex];

  switch (action) {
    case 'WOLF_KILL':
      nightKillTarget = playerId;
      break;
    case 'GUARD':
      nightGuardTarget = playerId;
      break;
    case 'SEER': {
      const target = getPlayerById(playerId);
      const isWolf = target.role === ROLES.WEREWOLF;
      const resultClass = isWolf ? 'result-black' : 'result-white';
      const resultText = isWolf ? '黒' : '白';
      const resultStep = {
        text: `<span class="${resultClass}">${target.name} ＝ ${resultText}</span>\n\n確認したら目を閉じてください。`,
        _seerResult: true
      };
      if (currentSteps[stepIndex + 1] && currentSteps[stepIndex + 1]._seerResult) {
        currentSteps[stepIndex + 1] = resultStep;
      } else {
        currentSteps.splice(stepIndex + 1, 0, resultStep);
      }
      break;
    }
    case 'VOTE': {
      const target = getPlayerById(playerId);
      const execStep = {
        text: `<span class="highlight">${target.name}</span>さんが処刑されました。`,
        _executeTarget: playerId
      };
      if (currentSteps[stepIndex + 1] && currentSteps[stepIndex + 1]._executeTarget !== undefined) {
        currentSteps[stepIndex + 1] = execStep;
      } else {
        currentSteps.splice(stepIndex + 1, 0, execStep);
      }
      break;
    }
  }

  step.actionDone = true;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = '次へ →';
  nextBtn.disabled = false;
}

// ===== ステップ進行 =====
function nextStep() {
  const step = currentSteps[stepIndex];
  if (!step) return;

  const selectActions = ['WOLF_KILL', 'GUARD', 'SEER', 'VOTE'];
  if (step.action && selectActions.includes(step.action) && !step.actionDone) return;

  hideTimer();
  
  // 現在のステップがTO_NIGHTトランジションの場合（夜へ進むボタンをクリックした時）
  if (step.action === 'TO_NIGHT' && step.transition) {
    day++;
    phase = 'night';
    buildNightPhase();
    renderStep();
    renderSidePanel();
    return;
  }

  // === 結果表示 ===
  if (step.action === 'SHOW_RESULT') {
    showResult(getWinner());
    return;
  }

  // === 夜→昼遷移 ===
  if (step.action === 'TO_DAY') {
    buildDayPhase();
    renderStep();
    renderSidePanel();
    return;
  }

  // === 夜解決→昼 ===
  if (step.action === 'RESOLVE_NIGHT') {
    resolveNight();
    buildDayPhase();
    renderStep();
    renderSidePanel();
    return;
  }

  // 次のステップへ
  stepIndex++;
  if (stepIndex >= currentSteps.length) {
    stepIndex = currentSteps.length - 1;
    return;
  }

  const nextS = currentSteps[stepIndex];

  // === 処刑実行 ===
  if (nextS._executeTarget !== undefined && !nextS._executed) {
    nextS._executed = true;
    const target = getPlayerById(nextS._executeTarget);
    killPlayer(target.id, '処刑');
    lastExecuted = target.id;

    if (isGameOver()) {
      // 処刑後の勝敗決定ステップを挿入
      currentSteps.splice(stepIndex + 1, 0, {
        text: '勝敗が決定しました。結果は...',
        action: 'SHOW_RESULT'
      });
    } else {
      // 夜へ直接進むステップ
      if (!currentSteps[stepIndex + 1] || !currentSteps[stepIndex + 1].transition) {
        currentSteps.splice(stepIndex + 1, 0, {
          text: '夜になりました。目を閉じてください。',
          transition: true, action: 'TO_NIGHT'
        });
      }
    }
  }

  // === 夜遷移 ===
  if (nextS.action === 'TO_NIGHT') {
    // 「夜になりました」を表示してから次クリックで夜フェーズへ
    renderStep();
    return;
  }

  renderStep();
}

function prevStep() {
  if (stepIndex > 0) {
    stepIndex--;
    hideTimer();
    renderStep();
  }
}

// ===== 夜の結果解決 =====
function resolveNight() {
  if (nightKillTarget !== null && nightGuardTarget !== null && nightKillTarget === nightGuardTarget) {
    nightKillTarget = '__guarded__';
  } else if (nightKillTarget !== null && nightKillTarget !== '__guarded__') {
    killPlayer(nightKillTarget, '襲撃');
  }
  lastGuarded = nightGuardTarget;
  nightGuardTarget = null;
}

// ===== プレイヤー死亡処理 =====
function killPlayer(playerId, cause) {
  const p = getPlayerById(playerId);
  if (!p || !p.alive) return;
  p.alive = false;
  p.causeOfDeath = cause;
  renderSidePanel();
}

// ===== 勝利判定 =====
function checkWinCondition() {
  if (isGameOver()) {
    showResult(getWinner());
    return true;
  }
  return false;
}

function showResult(winner) {
  hideTimer();
  const icon = document.getElementById('result-icon');
  const title = document.getElementById('result-title');
  const desc = document.getElementById('result-desc');
  const rolesDiv = document.getElementById('result-roles');

  if (winner === 'village') {
    icon.textContent = '🏘️';
    title.textContent = '市民陣営の勝利！';
    title.style.background = 'linear-gradient(135deg, #2ecc71, #3498db)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    desc.textContent = '人狼を全員追放しました！';
  } else {
    icon.textContent = '🐺';
    title.textContent = '人狼陣営の勝利！';
    title.style.background = 'linear-gradient(135deg, #e74c3c, #f39c12)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    desc.textContent = '人狼が村を支配しました…';
  }

  rolesDiv.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'result-role-card';
    card.innerHTML = `
      <div class="rname">${p.name}</div>
      <div class="rrole" style="color:${getRoleColor(p.role)}">${p.role}</div>
      <div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-top:4px">${p.alive ? '生存' : '死亡（' + p.causeOfDeath + '）'}</div>
    `;
    rolesDiv.appendChild(card);
  });

  switchScreen('result-screen');
}

function getRoleColor(role) {
  switch (role) {
    case ROLES.WEREWOLF: return '#e74c3c';
    case ROLES.SEER: return '#9b59b6';
    case ROLES.MEDIUM: return '#3498db';
    case ROLES.HUNTER: return '#e67e22';
    default: return '#2ecc71';
  }
}

// ===== サイドパネル更新 =====
function renderSidePanel() {
  const playerList = document.getElementById('player-list');
  const deadList = document.getElementById('dead-list');

  playerList.innerHTML = '';
  getAlive().forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <span class="dot"></span>
      <span>${p.name}</span>
      <span class="role-tag ${ROLE_CSS[p.role]}">${p.role}</span>
    `;
    playerList.appendChild(div);
  });

  const dead = players.filter(p => !p.alive);
  if (dead.length === 0) {
    deadList.innerHTML = '<p class="empty-msg">まだ誰も死亡していません</p>';
  } else {
    deadList.innerHTML = '';
    dead.forEach(p => {
      const div = document.createElement('div');
      div.className = 'dead-item';
      div.innerHTML = `
        <span>${p.name}</span>
        <span class="role-tag ${ROLE_CSS[p.role]}">${p.role}</span>
        <span class="cause">${p.causeOfDeath}</span>
      `;
      deadList.appendChild(div);
    });
  }

  document.getElementById('alive-count').textContent = getAlive().length;
  document.getElementById('village-count').textContent = getAliveVillagers().length;
  document.getElementById('wolf-count').textContent = getAliveWolves().length;
}

// ===== リセット =====
function confirmReset() {
  if (confirm('ゲームをリセットしますか？')) resetGame();
}

function resetGame() {
  players = [];
  day = 1;
  phase = 'night';
  stepIndex = 0;
  currentSteps = [];
  lastGuarded = null;
  lastExecuted = null;
  nightKillTarget = null;
  nightGuardTarget = null;
  hideTimer();
  document.body.classList.remove('night', 'day');
  switchScreen('setup-screen');
}
