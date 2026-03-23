/* ========================================
   人狼GMアシスタント — app.js
   ======================================== */

// ===== 定数 =====
const ROLES = {
  VILLAGER: '村人',
  WEREWOLF: '人狼',
  SEER:     '占い師',
  MEDIUM:   '霊能者',
  HUNTER:   '狩人',
  MADMAN:   '狂人'
};

const ROLE_CSS = {
  [ROLES.VILLAGER]: 'villager-tag',
  [ROLES.WEREWOLF]: 'werewolf-tag',
  [ROLES.SEER]:     'seer-tag',
  [ROLES.MEDIUM]:   'medium-tag',
  [ROLES.HUNTER]:   'hunter-tag',
  [ROLES.MADMAN]:   'madman-tag'
};

const ROLE_COLORS = {
  [ROLES.VILLAGER]: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71' },
  [ROLES.WEREWOLF]: { bg: 'rgba(192,57,43,.15)',  color: '#e74c3c' },
  [ROLES.SEER]:     { bg: 'rgba(155,89,182,.15)', color: '#9b59b6' },
  [ROLES.MEDIUM]:   { bg: 'rgba(52,152,219,.15)', color: '#3498db' },
  [ROLES.HUNTER]:   { bg: 'rgba(230,126,34,.15)', color: '#e67e22' },
  [ROLES.MADMAN]:   { bg: 'rgba(241,196,15,.15)',  color: '#f1c40f' }
};

const TIMER_MINUTES = 6;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 15;

// ===== 役職設定状態 =====
let numPlayers = 8;
let roleCounts = {
  [ROLES.VILLAGER]: 3,
  [ROLES.WEREWOLF]: 2,
  [ROLES.SEER]: 1,
  [ROLES.MEDIUM]: 1,
  [ROLES.HUNTER]: 1,
  [ROLES.MADMAN]: 0
};

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
let seerLog = [];

// ===== タイマー =====
let timerInterval = null;
let timerSeconds = TIMER_MINUTES * 60;
let timerRunning = false;

// ===== 初期化 =====
function initSetup() {
  renderRoleConfig();
  renderPlayerInputs();
  updateRoleHint();
  document.getElementById('btn-start').addEventListener('click', startGame);
}

function applyDefaults() {
  numPlayers = 8;
  document.getElementById('player-count-display').textContent = numPlayers;
  roleCounts = {
    [ROLES.VILLAGER]: 3,
    [ROLES.WEREWOLF]: 2,
    [ROLES.SEER]: 1,
    [ROLES.MEDIUM]: 1,
    [ROLES.HUNTER]: 1,
    [ROLES.MADMAN]: 0
  };
  renderRoleConfig();
  renderPlayerInputs();
  updateRoleHint();
}

function changePlayerCount(delta) {
  const newCount = numPlayers + delta;
  if (newCount < MIN_PLAYERS || newCount > MAX_PLAYERS) return;
  numPlayers = newCount;
  document.getElementById('player-count-display').textContent = numPlayers;
  
  // 役職合計がプレイヤー数を超えたら村人を自動調整
  const total = Object.values(roleCounts).reduce((s, v) => s + v, 0);
  if (total > numPlayers) {
    const diff = total - numPlayers;
    roleCounts[ROLES.VILLAGER] = Math.max(0, roleCounts[ROLES.VILLAGER] - diff);
    renderRoleConfig();
  }
  
  renderPlayerInputs();
  updateRoleHint();
}

function changeRoleCount(role, delta) {
  const newVal = roleCounts[role] + delta;
  if (newVal < 0) return;
  
  const total = Object.values(roleCounts).reduce((s, v) => s + v, 0) + delta;
  if (total > numPlayers) return;
  
  roleCounts[role] = newVal;
  renderRoleConfig();
  updateRoleHint();
}

function renderRoleConfig() {
  const container = document.getElementById('role-config');
  const roleList = [ROLES.VILLAGER, ROLES.WEREWOLF, ROLES.SEER, ROLES.MEDIUM, ROLES.HUNTER, ROLES.MADMAN];
  
  container.innerHTML = roleList.map(role => {
    const c = ROLE_COLORS[role];
    return `
      <div class="role-config-row" style="border-left:3px solid ${c.color}">
        <span class="role-config-name" style="color:${c.color}">${role}</span>
        <div class="role-config-controls">
          <button class="count-btn" onclick="changeRoleCount('${role}', -1)">−</button>
          <span class="role-config-val" id="rc-${role}">${roleCounts[role]}</span>
          <button class="count-btn" onclick="changeRoleCount('${role}', 1)">＋</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateRoleHint() {
  const total = Object.values(roleCounts).reduce((s, v) => s + v, 0);
  const hint = document.getElementById('role-count-hint');
  const remaining = numPlayers - total;
  
  if (remaining > 0) {
    hint.textContent = `合計: ${total} / ${numPlayers}（残り ${remaining} 人はランダム配役）`;
    hint.className = 'config-hint';
  } else if (remaining === 0) {
    hint.textContent = `合計: ${total} / ${numPlayers} ✓`;
    hint.className = 'config-hint';
  } else {
    hint.textContent = `合計: ${total} / ${numPlayers}（${Math.abs(remaining)} 人超過！）`;
    hint.className = 'config-hint error';
  }
}

function renderPlayerInputs() {
  const container = document.getElementById('player-inputs');
  // 既存の名前と役職を保存
  const existingNames = [];
  const existingRoles = [];
  for (let i = 0; i < container.children.length; i++) {
    const input = container.children[i].querySelector('input');
    const select = container.children[i].querySelector('select');
    if (input) existingNames.push(input.value);
    if (select) existingRoles.push(select.value);
  }
  
  container.innerHTML = '';
  for (let i = 0; i < numPlayers; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'player-input-wrap';
    
    // 役職オプション
    const roleOptions = [ROLES.VILLAGER, ROLES.WEREWOLF, ROLES.SEER, ROLES.MEDIUM, ROLES.HUNTER, ROLES.MADMAN];
    const optionsHTML = roleOptions.map(r => `<option value="${r}">${r}</option>`).join('');
    
    wrap.innerHTML = `
      <input type="text" id="pname-${i}" placeholder="プレイヤー${i + 1} の名前" maxlength="12" />
      <select id="prole-${i}" class="role-select">
        <option value="ランダム">ランダム</option>
        ${optionsHTML}
      </select>
    `;
    
    container.appendChild(wrap);
    
    // HTMLの崩れ（クォーテーション等）を防ぐため、JSプロパティで直接値を復元
    if (existingNames[i]) wrap.querySelector('input').value = existingNames[i];
    if (existingRoles[i]) wrap.querySelector('select').value = existingRoles[i];
  }
}

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

function renderSeerLog() {
  const container = document.getElementById('seer-log');
  if (seerLog.length === 0) {
    container.innerHTML = '<p class="empty-msg">まだ占い結果はありません</p>';
    return;
  }
  container.innerHTML = seerLog.map(entry => `
    <div class="log-item">
      <span class="log-day">${entry.day}日目</span>
      <span class="log-name">${entry.name}</span>
      <span class="log-result ${entry.isWolf ? 'black' : 'white'}">${entry.isWolf ? '黒' : '白'}</span>
    </div>
  `).join('');
}

// ===== ゲーム開始 =====
function startGame() {
  if (isStarting) return;
  isStarting = true;
  showError('');

  try {
    const names = [];
    const manualRoles = [];

    // 役職の合計チェック
    const totalRoles = Object.values(roleCounts).reduce((s, v) => s + v, 0);
    if (totalRoles > numPlayers) {
      showError(`役職の合計（${totalRoles}）がプレイヤー数（${numPlayers}）を超えています。`);
      return;
    }

    // 人狼が0人のチェック
    if (roleCounts[ROLES.WEREWOLF] < 1) {
      showError('人狼は最低1人必要です。');
      return;
    }

    for (let i = 0; i < numPlayers; i++) {
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

    // 手動指定のバリデーション
    const manualCounts = { [ROLES.VILLAGER]: 0, [ROLES.WEREWOLF]: 0, [ROLES.SEER]: 0, [ROLES.MEDIUM]: 0, [ROLES.HUNTER]: 0, [ROLES.MADMAN]: 0 };
    for (const r of manualRoles) {
      if (r !== 'ランダム') manualCounts[r]++;
    }

    for (const r in roleCounts) {
      if (manualCounts[r] > roleCounts[r]) {
        showError(`役職「${r}」の個別指定数（${manualCounts[r]}）が設定数（${roleCounts[r]}）を超えています。`);
        return;
      }
    }

    // ランダム枠に割り当てる役職のリストを準備
    const remainingRoles = [];
    for (const r in roleCounts) {
      const remainingCount = roleCounts[r] - manualCounts[r];
      for (let i = 0; i < remainingCount; i++) remainingRoles.push(r);
    }
    // 役職未割当の余り人数分は村人を追加
    const unassigned = numPlayers - totalRoles;
    // ランダム選択のうち、上の remainingRoles 以外のスロットは「余り分」→ 村人として追加
    const randomSlots = manualRoles.filter(r => r === 'ランダム').length;
    const extraVillagers = randomSlots - remainingRoles.length;
    for (let i = 0; i < extraVillagers; i++) remainingRoles.push(ROLES.VILLAGER);
    
    const shuffledRemaining = shuffle(remainingRoles);

    // プレイヤーへの割り当て
    players = names.map((name, i) => {
      let finalRole = manualRoles[i];
      if (finalRole === 'ランダム') {
        finalRole = shuffledRemaining.pop() || ROLES.VILLAGER;
      }
      return { id: i, name, role: finalRole, alive: true, causeOfDeath: null };
    });

    const villageSide = players.filter(p => p.role !== ROLES.WEREWOLF && p.role !== ROLES.SEER);
    randomWhiteTarget = villageSide.length > 0 
      ? villageSide[Math.floor(Math.random() * villageSide.length)]
      : players.find(p => p.role !== ROLES.WEREWOLF);

    day = 1;
    phase = 'night';
    stepIndex = 0;
    lastGuarded = null;
    lastExecuted = null;
    nightKillTarget = null;
    nightGuardTarget = null;
    seerLog = [];

    // 初日ランダム白をログに追加（占い師がいる場合のみ）
    if (getSeer() && randomWhiteTarget) {
      seerLog.push({ day: 1, name: randomWhiteTarget.name, isWolf: false, _stepIdx: -1 });
    }

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
    if (wolves.length > 0) {
      const wolfNames = wolves.map(w => w.name).join('、');
      currentSteps.push({
        text: '人狼は目を開けてください。\nお互いを確認してください。',
        note: `（人狼: ${wolfNames}）`
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ② 占い師
    const seers = players.filter(p => p.role === ROLES.SEER);
    if (seers.length > 0) {
      currentSteps.push({
        text: '占い師は目を開けてください。',
        note: `（占い師: ${seers.map(s => s.name).join('、')}）`
      });
      if (randomWhiteTarget) {
        currentSteps.push({
          text: `<span class="result-white">${randomWhiteTarget.name} ＝ 白</span>\n<span class="warn">（初日ランダム白）</span>\n\n確認したら目を閉じてください。`
        });
      } else {
        currentSteps.push({ text: '目を閉じてください。' });
      }
    }

    // ③ 狩人
    const hunters = players.filter(p => p.role === ROLES.HUNTER);
    if (hunters.length > 0) {
      currentSteps.push({
        text: '狩人は目を開けてください。',
        note: `（狩人: ${hunters.map(h => h.name).join('、')}）`
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ④ 霊能者
    const mediums = players.filter(p => p.role === ROLES.MEDIUM);
    if (mediums.length > 0) {
      currentSteps.push({
        text: '霊能者は目を開けてください。',
        note: `（霊能者: ${mediums.map(m => m.name).join('、')}）`
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ⑤ 狂人
    const madmen = players.filter(p => p.role === ROLES.MADMAN);
    if (madmen.length > 0) {
      const madmanNames = madmen.map(m => m.name).join('、');
      currentSteps.push({
        text: '狂人は目を開けてください。',
        note: `（狂人: ${madmanNames}）`
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

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
    const hunters = players.filter(p => p.role === ROLES.HUNTER && p.alive);
    if (hunters.length > 0) {
      currentSteps.push({
        text: '狩人は目を開けてください。\n守る人を指差してください。\n<span class="warn">※同じ人を連続護衛できません</span>',
        action: 'GUARD'
      });
      currentSteps.push({ text: '目を閉じてください。' });
    }

    // ③ 占い師
    const seers = players.filter(p => p.role === ROLES.SEER && p.alive);
    if (seers.length > 0) {
      currentSteps.push({
        text: '占い師は目を開けてください。\n占う人を指差してください。',
        action: 'SEER'
      });
      // 占い結果は選択後に動的挿入
    }

    // ④ 霊能者
    const mediums = players.filter(p => p.role === ROLES.MEDIUM && p.alive);
    if (mediums.length > 0 && lastExecuted !== null) {
      const exTarget = getPlayerById(lastExecuted);
      if (exTarget) {
        const isWolf = exTarget.role === ROLES.WEREWOLF;
        const resultClass = isWolf ? 'result-black' : 'result-white';
        const resultText = isWolf ? '黒' : '白';
        currentSteps.push({
          text: '霊能者は目を開けてください。',
          note: `（霊能者: ${mediums.map(m => m.name).join('、')}）`
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
    if (nightKillTarget !== null && nightKillTarget !== '__guarded__') {
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
      
      // ログに追加（重複防止：同じステップで再選択した場合を考慮）
      const logIndex = seerLog.findIndex(l => l.day === day && l._stepIdx === stepIndex);
      const logEntry = { day, name: target.name, isWolf, _stepIdx: stepIndex };
      if (logIndex >= 0) {
        seerLog[logIndex] = logEntry;
      } else {
        seerLog.push(logEntry);
      }
      renderSeerLog();
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
    case ROLES.MADMAN: return '#f1c40f';
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

  renderSeerLog();
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
  seerLog = [];
  hideTimer();
  document.body.classList.remove('night', 'day');
  switchScreen('setup-screen');
  renderPlayerInputs();
  renderRoleConfig();
  updateRoleHint();
  renderSeerLog();
}

// ===== 起動 =====
initSetup();
