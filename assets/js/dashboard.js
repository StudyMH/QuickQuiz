/**
 * StudySphere QuickQuiz 2.0 - Dashboard & Gateway Controller
 * Integrates Apps Script Web App, Firebase Auth, Countdown Timer,
 * Strict Demo Mode, Dual Donation System, and Warm Amber & Sage Palette.
 */

// Global Apps Script URL provided for Feedback & Error reporting
const APPS_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycby84rjwkrUX0D1OUU1fYNy60FtvNs6sxN4L3AHHYMLNSXDvJRAVOzANIsYQ-cA0Bqz8BA/exec";

// Runtime Dashboard State
const DashboardState = {
  activeTarget: null,
  tempFilter: null,
  isTestingKey: false,
  feedbackType: 'General Feedback',
  countdownInterval: null,
  donationAmount: 100
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  checkOnboardingGateway();
  setupDashboardEventListeners();
  renderDashboardOverview();
  startCountdownTimer();
  registerServiceWorker();

  // Check URL parameter: auto-open Key Modal if coming from completed demo
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('openKeyModal') === 'true') {
    const modal = document.getElementById('apiKeyModal');
    document.body.classList.add('overflow-hidden');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    updateApiModalState(AppStorage.getGeminiKey());
  }
});

// -------------------------------------------------------------
// 1. Theme & Language Engine
// -------------------------------------------------------------
function initTheme() {
  const currentTheme = AppStorage.getTheme();
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = '🌙';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  const newTheme = isDark ? 'dark' : 'light';
  AppStorage.setTheme(newTheme);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
}

function initLanguage() {
  const target = AppStorage.getExamTarget();
  const lang = target.lang || 'mr';
  const label = document.getElementById('langLabel');
  if (label) label.textContent = (lang === 'en') ? 'EN' : 'मराठी';
}

function toggleGlobalLanguage() {
  const target = AppStorage.getExamTarget();
  const nextLang = (target.lang === 'mr') ? 'en' : 'mr';
  target.lang = nextLang;
  AppStorage.setExamTarget(target);
  initLanguage();
  renderDashboardOverview();
  showToast(`माध्यम: ${nextLang === 'en' ? 'English' : 'मराठी'}`);
}

// -------------------------------------------------------------
// 2. Strict Onboarding Gateway & Non-bypassable Lockout
// -------------------------------------------------------------
function checkOnboardingGateway() {
  const apiKey = AppStorage.getGeminiKey();
  const isDemo = sessionStorage.getItem('qq_demo_active') === 'true';

  const modal = document.getElementById('apiKeyModal');
  const statusBadge = document.getElementById('headerStatusBadge');
  const statusText = document.getElementById('headerStatusText');
  const statusDot = document.getElementById('headerStatusDot');
  const btnCloseModal = document.getElementById('btnCloseApiKeyModal');
  const demoBanner = document.getElementById('demoNoticeBanner');
  const linkGetFree = document.getElementById('linkGetFreeKey');
  const brandLogoLink = document.getElementById('brandLogoLink');
  const demoCardContainer = document.getElementById('demoCardContainer');

  const metricsSection = document.getElementById('metricsContainerSection');
  const safeguardSection = document.getElementById('safeguardSection');

  // CRITICAL: If no real API key AND no active demo in session, FORCE LOCKOUT
  if (!apiKey && !isDemo) {
    document.body.classList.add('overflow-hidden');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    btnCloseModal?.classList.add('hidden');
    if (linkGetFree) linkGetFree.classList.remove('opacity-40', 'pointer-events-none');
    if (demoCardContainer) demoCardContainer.classList.remove('opacity-40', 'pointer-events-none');
    updateApiModalState(null);
  } else {
    document.body.classList.remove('overflow-hidden');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');

    if (apiKey) {
      // User has personal API key
      btnCloseModal?.classList.remove('hidden');
      if (linkGetFree) linkGetFree.classList.add('opacity-40', 'pointer-events-none');
      if (demoBanner) demoBanner.classList.add('hidden');
      
      // Disable Demo button on popup if API key is active
      if (demoCardContainer) demoCardContainer.classList.add('opacity-40', 'pointer-events-none');

      // Un-blur sections
      metricsSection?.classList.remove('opacity-30', 'blur-2xs', 'pointer-events-none');
      safeguardSection?.classList.remove('opacity-30', 'blur-2xs', 'pointer-events-none');

      // Brand logo clickable
      brandLogoLink?.classList.remove('pointer-events-none', 'cursor-default');

      if (statusBadge && statusText && statusDot) {
        statusBadge.classList.remove('hidden');
        statusBadge.className = "flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-[11px] font-black bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800";
        statusDot.className = "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500";
        statusText.textContent = "AI सक्रिय ✓";
      }
    } else if (isDemo) {
      // Demo session is active
      if (demoBanner) demoBanner.classList.remove('hidden');
      if (demoCardContainer) demoCardContainer.classList.remove('opacity-40', 'pointer-events-none');

      // Blur & Lock performance and safeguard
      metricsSection?.classList.add('opacity-30', 'blur-2xs', 'pointer-events-none');
      safeguardSection?.classList.add('opacity-30', 'blur-2xs', 'pointer-events-none');

      // Brand logo non-clickable in demo
      brandLogoLink?.classList.add('pointer-events-none', 'cursor-default');

      if (statusBadge && statusText && statusDot) {
        statusBadge.classList.remove('hidden');
        statusBadge.className = "flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-[11px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800";
        statusDot.className = "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-pulse";
        statusText.textContent = "डेमो मोड";
      }
    }
  }
}

function updateApiModalState(savedKey) {
  const input = document.getElementById('inputApiKey');
  const btnClear = document.getElementById('btnClearApiKeyInput');
  const btnCheck = document.getElementById('btnCheckKeyConnection');
  const btnDelete = document.getElementById('btnDeleteApiKey');
  const btnPaste = document.getElementById('btnPasteApiKey');
  const statusCont = document.getElementById('keyStatusContainer');
  const demoCardContainer = document.getElementById('demoCardContainer');

  if (savedKey) {
    if (input) {
      input.value = savedKey;
      input.disabled = true;
    }
    btnClear?.classList.remove('hidden');
    btnDelete?.classList.remove('hidden');
    if (btnPaste) btnPaste.disabled = true;
    if (btnCheck) {
      btnCheck.disabled = true;
      btnCheck.className = "flex-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-400 cursor-default";
      btnCheck.textContent = "✓ की सेव्ह झाली आहे (Key Active)";
    }
    if (demoCardContainer) demoCardContainer.classList.add('opacity-40', 'pointer-events-none');
  } else {
    if (input) {
      input.value = '';
      input.disabled = false;
    }
    btnClear?.classList.add('hidden');
    btnDelete?.classList.add('hidden');
    if (btnPaste) btnPaste.disabled = false;
    statusCont?.classList.add('hidden');
    if (btnCheck) {
      btnCheck.disabled = false;
      btnCheck.dataset.ready = "false";
      btnCheck.className = "flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs shadow-xs transition-all";
      btnCheck.textContent = "⚡ कनेक्शन तपासा (Check Connection)";
    }
    if (demoCardContainer) demoCardContainer.classList.remove('opacity-40', 'pointer-events-none');
  }
}

async function handleCheckConnection() {
  const input = document.getElementById('inputApiKey');
  const rawKey = input ? input.value.trim() : '';
  const statusCont = document.getElementById('keyStatusContainer');
  const statusText = document.getElementById('keyStatusText');
  const modelTag = document.getElementById('keyModelTag');
  const btnCheck = document.getElementById('btnCheckKeyConnection');
  const btnDelete = document.getElementById('btnDeleteApiKey');
  const demoCardContainer = document.getElementById('demoCardContainer');

  if (!rawKey || rawKey.length < 15) {
    statusCont?.classList.remove('hidden');
    if (statusText) {
      statusText.textContent = "कृपया वैध Gemini Key टाका (AIzaSy...)";
      statusText.className = "text-rose-500";
    }
    return;
  }

  // If already verified, clicking saves and immediately locks the button
  if (btnCheck && btnCheck.dataset.ready === "true") {
    AppStorage.setGeminiKey(rawKey);
    sessionStorage.removeItem('qq_demo_active');

    btnCheck.disabled = true;
    btnCheck.className = "flex-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-400 cursor-default";
    btnCheck.textContent = "✓ की सेव्ह झाली आहे (Key Active)";
    
    if (demoCardContainer) demoCardContainer.classList.add('opacity-40', 'pointer-events-none');

    showToast("AI Key यशस्वीरित्या सेव्ह झाली!");
    setTimeout(() => {
      checkOnboardingGateway();
      renderDashboardOverview();
    }, 400);
    return;
  }

  // Testing connection with fallback models while disabling input
  DashboardState.isTestingKey = true;
  if (input) input.disabled = true;
  if (btnCheck) {
    btnCheck.disabled = true;
    btnCheck.className = "flex-1 py-2.5 rounded-xl bg-slate-400 text-white font-black text-xs cursor-wait";
    btnCheck.textContent = "कनेक्शन तपासत आहोत...";
  }
  statusCont?.classList.remove('hidden');
  if (statusText) {
    statusText.textContent = "Gemini AI शी संपर्क जोडला जात आहे...";
    statusText.className = "text-sky-500";
  }

  const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  let verifiedModel = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${rawKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
      });
      if (res.ok) {
        verifiedModel = model;
        break;
      }
    } catch (e) {
      // try next fallback
    }
  }

  DashboardState.isTestingKey = false;
  if (btnCheck) btnCheck.disabled = false;

  if (verifiedModel) {
    if (statusText) {
      statusText.textContent = "कनेक्शन यशस्वी! ✓";
      statusText.className = "text-emerald-600";
    }
    if (modelTag) {
      modelTag.textContent = verifiedModel;
      modelTag.classList.remove('hidden');
    }

    if (btnCheck) {
      btnCheck.dataset.ready = "true";
      btnCheck.className = "flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs active:scale-95 transition-all";
      btnCheck.textContent = "✓ सेव्ह करा आणि सुरू करा (Save & Continue)";
    }
    btnDelete?.classList.remove('hidden');
  } else {
    if (input) input.disabled = false;
    if (statusText) {
      statusText.textContent = "कनेक्शन अयशस्वी. कृपया Key पुन्हा तपासा.";
      statusText.className = "text-rose-500";
    }
    modelTag?.classList.add('hidden');

    if (btnCheck) {
      btnCheck.dataset.ready = "false";
      btnCheck.className = "flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all";
      btnCheck.textContent = "🔄 पुन्हा प्रयत्न करा (Try Again)";
    }
  }
}

function handleDeleteApiKey() {
  AppStorage.setGeminiKey('');
  sessionStorage.removeItem('qq_demo_active');
  updateApiModalState(null);
  showToast("API Key डिलीट केली गेली.", true);
  checkOnboardingGateway();
}

function handleEnterDemo() {
  sessionStorage.setItem('qq_demo_active', 'true');
  const demoTarget = {
    exam: 'group-c',
    stage: 'Prelims',
    syllabusMode: 'compact',
    subjects: ['भूगोल (महाराष्ट्र प्राथमिक संदर्भ)', 'इतिहास (महाराष्ट्र व भारत)'],
    microTopics: [],
    diff: 'Medium',
    lang: 'mr'
  };
  AppStorage.setExamTarget(demoTarget);
  showToast("डेमो मोड सक्रिय! २ आदर्श प्रश्न उपलब्ध.");
  checkOnboardingGateway();
  renderDashboardOverview();
}

// -------------------------------------------------------------
// 3. Countdown Timer (3 Jan 2027)
// -------------------------------------------------------------
function startCountdownTimer() {
  const targetDate = new Date('2027-01-03T00:00:00+05:30').getTime();

  function update() {
    const now = Date.now();
    const diff = targetDate - now;

    if (diff <= 0) {
      const d = document.getElementById('cdDays');
      const h = document.getElementById('cdHours');
      const m = document.getElementById('cdMinutes');
      const s = document.getElementById('cdSeconds');
      if (d) d.textContent = '00';
      if (h) h.textContent = '00';
      if (m) m.textContent = '00';
      if (s) s.textContent = '00';
      clearInterval(DashboardState.countdownInterval);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n) => String(n).padStart(2, '0');

    const dEl = document.getElementById('cdDays');
    const hEl = document.getElementById('cdHours');
    const mEl = document.getElementById('cdMinutes');
    const sEl = document.getElementById('cdSeconds');

    if (dEl) dEl.textContent = pad(days);
    if (hEl) hEl.textContent = pad(hours);
    if (mEl) mEl.textContent = pad(minutes);
    if (sEl) sEl.textContent = pad(seconds);
  }

  update();
  DashboardState.countdownInterval = setInterval(update, 1000);
}

// -------------------------------------------------------------
// 4. Active Target & Overview Rendering
// -------------------------------------------------------------
function renderDashboardOverview() {
  const target = AppStorage.getExamTarget();
  DashboardState.activeTarget = target;

  const examMap = {
    'group-c': 'MPSC Combine गट क (Group C)',
    'group-b': 'MPSC Combine गट ब (Group B)',
    'rajyaseva': 'MPSC राज्यसेवा (Rajyaseva)'
  };

  const unsetState = document.getElementById('heroUnsetState');
  const activeState = document.getElementById('heroActiveState');

  if (target && target.exam) {
    unsetState?.classList.add('hidden');
    activeState?.classList.remove('hidden');

    const examTitleEl = document.getElementById('heroExamTitle');
    if (examTitleEl) {
      examTitleEl.textContent = `${examMap[target.exam] || target.exam} • ${target.stage || 'पूर्व परीक्षा'}`;
    }

    const subText = Array.isArray(target.subjects) ? target.subjects.join(', ') : (target.subject || 'सामान्य अध्ययन');
    const microText = (target.syllabusMode === 'detailed' && Array.isArray(target.microTopics) && target.microTopics.length > 0) 
      ? ` [घटक: ${target.microTopics.join(', ')}]` 
      : '';
    
    const metaEl = document.getElementById('heroExamMeta');
    if (metaEl) {
      metaEl.textContent = `घटक: ${subText}${microText} • काठिण्य: ${target.diff || 'Medium'}`;
    }

    const badgeModeEl = document.getElementById('badgeTargetMode');
    if (badgeModeEl) {
      badgeModeEl.textContent = (target.syllabusMode || 'compact').toUpperCase();
    }
  } else {
    unsetState?.classList.remove('hidden');
    activeState?.classList.add('hidden');
  }

  // Metrics Calculation
  const history = AppStorage.getSessionHistory();
  const vault = AppStorage.getVault();

  let attempted = 0;
  let correct = 0;
  if (Array.isArray(history)) {
    history.forEach(item => {
      if (item && item.isAnswered) {
        attempted++;
        if (item.selectedOptionIndex === item.question?.correctAnswerIndex) {
          correct++;
        }
      }
    });
  }

  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const vaultCount = Object.keys(vault || {}).length;

  const statAttempted = document.getElementById('statAttempted');
  const statAccuracy = document.getElementById('statAccuracy');
  const statVaultCount = document.getElementById('statVaultCount');

  if (statAttempted) statAttempted.textContent = attempted.toString();
  if (statAccuracy) statAccuracy.textContent = `${accuracy}%`;
  if (statVaultCount) statVaultCount.textContent = vaultCount.toString();
}

// -------------------------------------------------------------
// 5. Target Filter Modal
// -------------------------------------------------------------
function openTargetFilterModal() {
  const isDemo = sessionStorage.getItem('qq_demo_active') === 'true';

  DashboardState.tempFilter = JSON.parse(JSON.stringify(AppStorage.getExamTarget()));
  if (!DashboardState.tempFilter.syllabusMode) DashboardState.tempFilter.syllabusMode = 'compact';
  if (!Array.isArray(DashboardState.tempFilter.subjects) || DashboardState.tempFilter.subjects.length === 0) {
    DashboardState.tempFilter.subjects = ['इतिहास (महाराष्ट्र व भारत)'];
  }
  if (!Array.isArray(DashboardState.tempFilter.microTopics)) {
    DashboardState.tempFilter.microTopics = [];
  }

  renderFilterModalUI(isDemo);
  const modal = document.getElementById('targetFilterModal');
  document.body.classList.add('overflow-hidden');
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

function closeTargetFilterModal() {
  const modal = document.getElementById('targetFilterModal');
  document.body.classList.remove('overflow-hidden');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

function renderFilterModalUI(isDemo = false) {
  const f = DashboardState.tempFilter;
  const syllabusData = AppStorage.SYLLABUS_DATA;

  // 1. Syllabus Mode
  const btnCompact = document.getElementById('btnModeCompact');
  const btnDetailed = document.getElementById('btnModeDetailed');
  const modeLabel = document.getElementById('currentModeLabel');

  if (btnCompact) btnCompact.disabled = isDemo;
  if (btnDetailed) btnDetailed.disabled = isDemo;

  if (f.syllabusMode === 'detailed') {
    if (btnDetailed) btnDetailed.className = "py-2 px-2.5 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-2xs transition-all duration-200 transform active:scale-95";
    if (btnCompact) btnCompact.className = "py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all duration-200 transform active:scale-95";
    if (modeLabel) modeLabel.textContent = "सखोल उपघटक (Detailed Focus)";
  } else {
    if (btnCompact) btnCompact.className = "py-2 px-2.5 rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-2xs transition-all duration-200 transform active:scale-95";
    if (btnDetailed) btnDetailed.className = "py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all duration-200 transform active:scale-95";
    if (modeLabel) modeLabel.textContent = "सर्वसाधारण घटक (Compact Focus)";
  }

  // 2. Exam Pills
  document.querySelectorAll('.exam-pill').forEach(btn => {
    const isSel = (btn.id === 'btnExamGroupC' && f.exam === 'group-c') ||
                  (btn.id === 'btnExamGroupB' && f.exam === 'group-b') ||
                  (btn.id === 'btnExamRajya' && f.exam === 'rajyaseva');
    btn.className = isSel
      ? "exam-pill py-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500 font-black text-[11px] sm:text-xs text-center shadow-2xs transition-all duration-200 transform active:scale-95"
      : "exam-pill py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold text-center transition-all duration-200 transform active:scale-95";
    btn.disabled = isDemo;
  });

  // 3. Stage Pills
  document.querySelectorAll('.stage-pill').forEach(btn => {
    const isSel = (btn.id === 'btnStagePrelims' && f.stage === 'Prelims') ||
                  (btn.id === 'btnStageMains' && f.stage === 'Mains');
    btn.className = isSel
      ? "stage-pill py-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500 font-black text-[11px] sm:text-xs text-center shadow-2xs transition-all duration-200 transform active:scale-95"
      : "stage-pill py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold text-center transition-all duration-200 transform active:scale-95";
    btn.disabled = isDemo;
  });

  // 4. Dynamic Subjects Container
  const container = document.getElementById('dynamicSubjectsContainer');
  if (container) {
    container.innerHTML = '';
    const stageData = syllabusData[f.exam]?.stages?.[f.stage] || syllabusData['group-c'].stages['Prelims'];

    if (f.syllabusMode === 'detailed') {
      const detailedGroups = stageData.detailed || [];
      detailedGroups.forEach(grp => {
        const grpCard = document.createElement('div');
        grpCard.className = "w-full p-2.5 rounded-2xl bg-amber-50/40 dark:bg-slate-800/40 border border-amber-200/80 dark:border-slate-700 space-y-1.5 mb-1";

        const title = document.createElement('h5');
        title.className = "text-[10px] font-black uppercase text-amber-900 dark:text-amber-300";
        title.textContent = grp.category;
        grpCard.appendChild(title);

        const subChips = document.createElement('div');
        subChips.className = "flex flex-wrap gap-1";

        grp.topics.forEach(t => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.disabled = isDemo;
          const isSel = f.microTopics.includes(t);
          btn.className = isSel
            ? "px-2 py-1 rounded-lg border-2 border-amber-500 bg-amber-500 text-slate-950 text-[11px] font-black shadow-2xs transition-all duration-200 transform active:scale-95 disabled:opacity-60"
            : "px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-all duration-200 transform hover:border-amber-400 active:scale-95 disabled:opacity-60";
          btn.textContent = t;
          if (!isDemo) btn.onclick = () => toggleMicroTopicSelection(t, grp.category);
          subChips.appendChild(btn);
        });

        grpCard.appendChild(subChips);
        container.appendChild(grpCard);
      });
    } else {
      const compactList = stageData.compact || [];
      compactList.forEach(sub => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = isDemo;
        const isSel = f.subjects.includes(sub);
        btn.className = isSel
          ? "px-2.5 py-1.5 rounded-xl border-2 border-amber-500 bg-amber-500 text-slate-950 text-xs font-black shadow-2xs transition-all duration-200 transform active:scale-95 disabled:opacity-60"
          : "px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all duration-200 transform hover:border-amber-400 active:scale-95 disabled:opacity-60";
        btn.textContent = sub;
        if (!isDemo) btn.onclick = () => toggleCompactSubjectSelection(sub);
        container.appendChild(btn);
      });
    }
  }

  // 5. Update Selection Counters
  const countLabel = document.getElementById('selectedSubjectsCount');
  const count = f.syllabusMode === 'detailed' ? f.microTopics.length : f.subjects.length;
  if (countLabel) countLabel.textContent = `${count} घटक निवडले`;

  const applyBtn = document.getElementById('btnApplyAndStartQuiz');
  if (applyBtn) {
    applyBtn.disabled = isDemo || (count === 0);
  }

  const clearBtn = document.getElementById('btnClearAllFilterSubjects');
  if (clearBtn) clearBtn.disabled = isDemo;

  // 6. Difficulty & Lang Pills
  document.querySelectorAll('.diff-pill').forEach(btn => {
    const isSel = (btn.id === 'btnDiffMed' && f.diff === 'Medium') || (btn.id === 'btnDiffHard' && f.diff === 'Hard');
    btn.className = isSel
      ? "diff-pill py-1.5 rounded-xl border-2 border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[11px] sm:text-xs text-center transition-all duration-200 transform active:scale-95"
      : "diff-pill py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold text-center transition-all duration-200 transform active:scale-95";
    btn.disabled = isDemo;
  });

  document.querySelectorAll('.lang-pill').forEach(btn => {
    const isSel = (btn.id === 'btnLangMr' && f.lang === 'mr') || (btn.id === 'btnLangEn' && f.lang === 'en');
    btn.className = isSel
      ? "lang-pill py-1.5 rounded-xl border-2 border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[11px] sm:text-xs text-center transition-all duration-200 transform active:scale-95"
      : "lang-pill py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold text-center transition-all duration-200 transform active:scale-95";
    btn.disabled = isDemo;
  });
}

function toggleCompactSubjectSelection(sub) {
  const f = DashboardState.tempFilter;
  if (f.subjects.includes(sub)) {
    f.subjects = f.subjects.filter(s => s !== sub);
  } else {
    f.subjects.push(sub);
  }
  renderFilterModalUI();
}

function toggleMicroTopicSelection(t, category) {
  const f = DashboardState.tempFilter;
  if (f.microTopics.includes(t)) {
    f.microTopics = f.microTopics.filter(item => item !== t);
  } else {
    f.microTopics.push(t);
  }
  if (!f.subjects.includes(category)) f.subjects.push(category);
  renderFilterModalUI();
}

function applyTargetFiltersAndRedirect() {
  const f = DashboardState.tempFilter;
  const count = f.syllabusMode === 'detailed' ? f.microTopics.length : f.subjects.length;
  if (count === 0) {
    showToast("कृपया किमान १ विषय किंवा घटक निवडा.", true);
    return;
  }

  AppStorage.setExamTarget(f);
  closeTargetFilterModal();
  renderDashboardOverview();
  showToast("ध्येय अद्ययावत! सराव सुरू करत आहोत...");

  setTimeout(() => {
    window.location.href = './quiz.html';
  }, 300);
}

// -------------------------------------------------------------
// 6. Google Apps Script Feedback Integration
// -------------------------------------------------------------
async function handleFeedbackSubmit() {
  const nameInput = document.getElementById('fbInputName');
  const qIdInput = document.getElementById('fbInputQuestionId');
  const msgInput = document.getElementById('fbInputMessage');
  const btnSubmit = document.getElementById('btnSubmitFeedback');

  const message = msgInput?.value.trim();
  if (!message) {
    showToast("कृपया संदेश किंवा अडचण टाईप करा.", true);
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "पाठवत आहोत... ⏳";
  }

  const payload = {
    type: DashboardState.feedbackType,
    name: nameInput?.value.trim() || "Anonymous",
    questionId: qIdInput?.value.trim() || "-",
    message: message
  };

  try {
    await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    showToast("✓ माहिती Google Sheet मध्ये यशस्वीरित्या नोंदवली गेली!");
    if (msgInput) msgInput.value = '';
    if (nameInput) nameInput.value = '';
    if (qIdInput) qIdInput.value = '';
    closeFeedbackModal();
  } catch (err) {
    showToast("त्रुटी! कृपया इंटरनेट तपासा.", true);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "पाठवा (Submit to Google Sheet) 🚀";
    }
  }
}

function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  document.body.classList.add('overflow-hidden');
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  document.body.classList.remove('overflow-hidden');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

// -------------------------------------------------------------
// 7. Dual Donation System
// -------------------------------------------------------------
function setDonationAmount(amt) {
  DashboardState.donationAmount = amt;
  const customInput = document.getElementById('customDonationAmount');
  if (customInput) customInput.value = amt;

  document.querySelectorAll('.donation-amt-btn').forEach(btn => {
    if (btn.innerText.includes(amt.toString())) {
      btn.className = 'donation-amt-btn py-1.5 px-2 text-xs font-bold rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 transition-all duration-200 transform active:scale-95';
    } else {
      btn.className = 'donation-amt-btn py-1.5 px-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all duration-200 transform active:scale-95';
    }
  });

  updateDesktopQR();
}

function updateDesktopQR() {
  const qrImg = document.getElementById('dynamicQRImg');
  const label = document.getElementById('desktopQrAmountLabel');
  if (label) label.textContent = `स्कॅन रक्कम: ₹ ${DashboardState.donationAmount}`;

  const secretUPI = "vikram.joshi9089@oksbi";
  const upiUri = `upi://pay?pa=${secretUPI}&pn=StudySphere&am=${DashboardState.donationAmount}&cu=INR&tn=StudySphere%20Donation`;
  const primaryUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(upiUri)}`;

  if (qrImg) qrImg.src = primaryUrl;
}

function triggerMobileUPI() {
  const secretUPI = "vikram.joshi9089@oksbi";
  const payeeName = "StudySphere";
  const note = encodeURIComponent("StudySphere MPSC Donation");
  const upiUrl = `upi://pay?pa=${secretUPI}&pn=${payeeName}&am=${DashboardState.donationAmount}&cu=INR&tn=${note}`;
  window.location.href = upiUrl;
}

// -------------------------------------------------------------
// 8. Policy Modals
// -------------------------------------------------------------
const POLICY_DATA = {
  about: {
    title: "StudySphere बद्दल (About Us & Mission)",
    content: `
      <p><strong>StudySphere</strong> हे महाराष्ट्र लोकसेवा आयोग (MPSC) द्वारे आयोजित केल्या जाणाऱ्या संयुक्त परीक्षांसाठी विशेषत्वाने विकसित केलेले एक अत्याधुनिक, जाहिरातमुक्त आणि विनामूल्य डिजिटल सराव व्यासपीठ आहे.</p>
      <div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
        <h4 class="font-bold text-amber-900 dark:text-amber-200 mb-1">🎯 आमचे ध्येय (Mission):</h4>
        <p>क्लास न लावता सेल्फ-स्टडी करणाऱ्या प्रत्येक गरजू विद्यार्थ्याला दर्जेदार, परीक्षाभिमुख आणि आयोगाच्या अद्ययावत अभ्यासक्रमानुसार सराव प्रश्नपत्रिका विनामूल्य उपलब्ध करून देणे.</p>
      </div>
      <div class="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60">
        <h4 class="font-bold text-slate-900 dark:text-white mb-1">AI BYOK (Bring Your Own Key) मॉडेल:</h4>
        <p>विद्यार्थी स्वतःची मोफत Gemini Key वापरून थेट आयोगाच्या निकषांवर आधारित अमर्यादित प्रश्न व सविस्तर उत्तरे मिळवू शकतात. कोणताही छुपा चार्ज आकारला जात नाही.</p>
      </div>
    `
  },
  privacy: {
    title: "गोपनीयता धोरण (Privacy & AI Key Policy)",
    content: `
      <p>StudySphere वर विद्यार्थ्यांच्या गोपनीयतेचे १००% संरक्षण केले जाते. आमचा प्लॅटफॉर्म <strong>Zero Server Tracking & Offline-First</strong> तत्त्वावर आधारलेला आहे.</p>
      <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
        <h4 class="font-bold text-emerald-900 dark:text-emerald-200 mb-1">१. शून्य वैयक्तिक डेटा संकलन:</h4>
        <p>आम्ही नाव, फोन नंबर किंवा पासवर्ड अशी कोणतीही वैयक्तिक माहिती गोळा करत नाही. चाचण्या सोडवण्यासाठी अनिवार्य लॉगिनची आवश्यकता नाही.</p>
      </div>
      <div class="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
        <h4 class="font-bold text-amber-900 dark:text-amber-200 mb-1">२. AI API Key स्थानिक सुरक्षा:</h4>
        <p>तुमची API Key केवळ तुमच्या स्वतःच्या डिव्हाइसमधील <code>localStorage</code> मध्ये स्थानिक स्वरूपात राहते. ती कोणत्याही बाह्य सर्व्हरवर पाठवली जात नाही.</p>
      </div>
    `
  },
  terms: {
    title: "नियम व अटी (Terms & Conditions)",
    content: `
      <p>StudySphere प्लॅटफॉर्मचा वापर करताना खालील नियम व अटी लागू राहतील:</p>
      <ul class="list-disc list-inside space-y-1.5">
        <li><strong>केवळ शैक्षणिक सराव:</strong> या संकेतस्थळावरील प्रश्न व स्पष्टीकरणे केवळ वैयक्तिक मार्गदर्शनासाठी आहेत.</li>
        <li><strong>शासकीय आयोगाशी थेट संबंध नाही:</strong> StudySphere हा एक स्वतंत्र विद्यार्थी-हितैषी उपक्रम आहे. अधिकृत अंतिम निकालासाठी MPSC च्या अधिकृत संकेतस्थळाचा संदर्भ घ्यावा.</li>
        <li><strong>AI स्पष्टीकरणे:</strong> AI द्वारे दिलेली उत्तरे अभ्यासाच्या संदर्भासाठी आहेत; अंतिम सत्य म्हणून अधिकृत संदर्भपुस्तके प्रमाण मानावीत.</li>
      </ul>
    `
  },
  sitemap: {
    title: "साइटमॅप व अभ्यासक्रम रचना (Website Sitemap)",
    content: `
      <p>StudySphere प्लॅटफॉर्मवरील अभ्यासक्रमाची त्रिस्तरीय रचना:</p>
      <div class="space-y-2">
        <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
          <strong class="text-amber-700 dark:text-amber-400">१. MPSC Group C (पूर्व व मुख्य):</strong>
          <p class="text-[11px] mt-0.5">• पूर्व: इतिहास, भूगोल, राज्यघटना, अर्थव्यवस्था, विज्ञान, CSAT.<br>• मुख्य: मराठी/इंग्रजी भाषा, RTI 2005, RTS 2015, लेखाकर्म, संगणक.</p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
          <strong class="text-emerald-700 dark:text-emerald-400">२. MPSC Group B (संयुक्त पूर्व व मुख्य):</strong>
          <p class="text-[11px] mt-0.5">• संयुक्त पेपर १ व २, कायदे, समाजसुधारक, २०११ जनगणना, PSI/STI/ASO पदनिहाय विशेष घटक.</p>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
          <strong class="text-indigo-700 dark:text-indigo-400">३. MPSC राज्यसेवा (Rajyaseva):</strong>
          <p class="text-[11px] mt-0.5">• पूर्व परीक्षा GS & CSAT, मुख्य परीक्षा GS-1 ते GS-4 (Ethics) सखोल सराव.</p>
        </div>
      </div>
    `
  },
  storage: {
    title: "डिव्हाइस स्टोरेज धोरण (Offline Storage Policy)",
    content: `
      <p>StudySphere प्लॅटफॉर्म <strong>"Offline-First & Zero Cloud Tracking"</strong> या तत्त्वावर काम करतो:</p>
      <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
        <h4 class="font-bold text-emerald-900 dark:text-emerald-200 mb-1">स्थानिक साठवणूक (Local Device Storage):</h4>
        <p>सोडवलेल्या चाचण्यांचे गुण, रिव्हिजन वॉल्टमधील कठीण प्रश्न आणि प्रोग्रेस केवळ तुमच्या फोनमधील <code>localStorage</code> मध्ये १००% स्थानिक स्वरूपात जतन होतात.</p>
      </div>
      <p>• <strong>बॅकअप सुविधा:</strong> डॅशबोर्डवरून तुम्ही तुमचा अभ्यास इतिहास JSON स्वरूपात डाउनलोड (Export) करून सुरक्षित ठेवू शकता.</p>
    `
  }
};

function openPolicyModal(type) {
  const data = POLICY_DATA[type];
  if (!data) return;
  const titleEl = document.getElementById('policyModalTitle');
  const bodyEl = document.getElementById('policyModalBody');
  if (titleEl) titleEl.textContent = data.title;
  if (bodyEl) bodyEl.innerHTML = data.content;
  const modal = document.getElementById('policyModal');
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

function closePolicyModal() {
  const modal = document.getElementById('policyModal');
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
}

// -------------------------------------------------------------
// 9. Event Listeners Setup
// -------------------------------------------------------------
function setupDashboardEventListeners() {
  document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btnLangToggle')?.addEventListener('click', toggleGlobalLanguage);

  // Side Drawer
  const drawer = document.getElementById('sideMenuDrawer');
  document.getElementById('btnMenuToggle')?.addEventListener('click', () => drawer?.classList.remove('hidden'));
  document.getElementById('btnCloseMenu')?.addEventListener('click', () => drawer?.classList.add('hidden'));
  drawer?.addEventListener('click', (e) => { if (e.target === drawer) drawer.classList.add('hidden'); });

  // Key Modal Openers
  const openKeyModal = () => {
    drawer?.classList.add('hidden');
    const modal = document.getElementById('apiKeyModal');
    document.body.classList.add('overflow-hidden');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    updateApiModalState(AppStorage.getGeminiKey());
  };

  document.getElementById('btnOpenKeyModalFromMenu')?.addEventListener('click', openKeyModal);
  document.getElementById('btnOpenKeyModalFront')?.addEventListener('click', openKeyModal);
  document.getElementById('btnOpenKeyModalFromDemoBanner')?.addEventListener('click', openKeyModal);
  document.getElementById('btnCloseApiKeyModal')?.addEventListener('click', () => {
    document.getElementById('apiKeyModal')?.classList.add('hidden');
    document.getElementById('apiKeyModal')?.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  });

  // API Key Input Controls
  const inputKey = document.getElementById('inputApiKey');
  const btnClear = document.getElementById('btnClearApiKeyInput');
  const btnPaste = document.getElementById('btnPasteApiKey');
  const btnToggleVis = document.getElementById('btnToggleApiKeyVisibility');

  const checkPasteBtnState = () => {
    const val = inputKey ? inputKey.value.trim() : '';
    if (btnPaste) btnPaste.disabled = (val.length > 0);
    if (btnClear) btnClear.classList.toggle('hidden', val.length === 0);
  };

  inputKey?.addEventListener('input', () => {
    checkPasteBtnState();
    const btnCheck = document.getElementById('btnCheckKeyConnection');
    if (btnCheck) {
      btnCheck.dataset.ready = "false";
      btnCheck.className = "flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs shadow-xs transition-all";
      btnCheck.textContent = "⚡ कनेक्शन तपासा (Check Connection)";
    }
    document.getElementById('keyStatusContainer')?.classList.add('hidden');
  });

  btnClear?.addEventListener('click', () => {
    if (inputKey) {
      inputKey.value = '';
      checkPasteBtnState();
      inputKey.focus();
    }
  });

  btnPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && inputKey) {
        inputKey.value = text.trim();
        checkPasteBtnState();
        showToast("क्लिपबोर्डवरून पेस्ट झाले!");
      }
    } catch (e) {
      showToast("क्लिपबोर्ड परवानगी आवश्यक आहे.", true);
    }
  });

  btnToggleVis?.addEventListener('click', () => {
    if (inputKey) {
      inputKey.type = (inputKey.type === 'password') ? 'text' : 'password';
    }
  });

  document.getElementById('btnCheckKeyConnection')?.addEventListener('click', handleCheckConnection);
  document.getElementById('btnDeleteApiKey')?.addEventListener('click', handleDeleteApiKey);
  document.getElementById('btnTryDemoMode')?.addEventListener('click', handleEnterDemo);

  // Target Filter Openers
  document.getElementById('btnOpenFilterFirstTime')?.addEventListener('click', openTargetFilterModal);
  document.getElementById('btnChangeFilter')?.addEventListener('click', openTargetFilterModal);
  document.getElementById('btnCloseFilterModal')?.addEventListener('click', closeTargetFilterModal);
  document.getElementById('btnApplyAndStartQuiz')?.addEventListener('click', applyTargetFiltersAndRedirect);

  // Filter Clear All
  document.getElementById('btnClearAllFilterSubjects')?.addEventListener('click', () => {
    DashboardState.tempFilter.subjects = [];
    DashboardState.tempFilter.microTopics = [];
    renderFilterModalUI();
  });

  // Filter Mode Toggles
  document.getElementById('btnModeCompact')?.addEventListener('click', () => {
    DashboardState.tempFilter.syllabusMode = 'compact';
    renderFilterModalUI();
  });
  document.getElementById('btnModeDetailed')?.addEventListener('click', () => {
    DashboardState.tempFilter.syllabusMode = 'detailed';
    renderFilterModalUI();
  });

  // Filter Exam Pills
  document.getElementById('btnExamGroupC')?.addEventListener('click', () => {
    DashboardState.tempFilter.exam = 'group-c';
    resetFilterSubjectsForExam();
  });
  document.getElementById('btnExamGroupB')?.addEventListener('click', () => {
    DashboardState.tempFilter.exam = 'group-b';
    resetFilterSubjectsForExam();
  });
  document.getElementById('btnExamRajya')?.addEventListener('click', () => {
    DashboardState.tempFilter.exam = 'rajyaseva';
    resetFilterSubjectsForExam();
  });

  // Filter Stage Pills
  document.getElementById('btnStagePrelims')?.addEventListener('click', () => {
    DashboardState.tempFilter.stage = 'Prelims';
    resetFilterSubjectsForExam();
  });
  document.getElementById('btnStageMains')?.addEventListener('click', () => {
    DashboardState.tempFilter.stage = 'Mains';
    resetFilterSubjectsForExam();
  });

  // Difficulty & Lang Pills
  document.getElementById('btnDiffMed')?.addEventListener('click', () => {
    DashboardState.tempFilter.diff = 'Medium';
    renderFilterModalUI();
  });
  document.getElementById('btnDiffHard')?.addEventListener('click', () => {
    DashboardState.tempFilter.diff = 'Hard';
    renderFilterModalUI();
  });
  document.getElementById('btnLangMr')?.addEventListener('click', () => {
    DashboardState.tempFilter.lang = 'mr';
    renderFilterModalUI();
  });
  document.getElementById('btnLangEn')?.addEventListener('click', () => {
    DashboardState.tempFilter.lang = 'en';
    renderFilterModalUI();
  });

  // Export Backup
  document.getElementById('btnExportBackup')?.addEventListener('click', () => {
    const backupData = {
      vault: AppStorage.getVault(),
      history: AppStorage.getSessionHistory(),
      target: AppStorage.getExamTarget(),
      streak: AppStorage.getStreak(),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuickQuiz_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ बॅकअप फाईल डाउनलोड झाली!");
  });

  // Firebase Cloud Sync Action
  document.getElementById('btnTriggerCloudSync')?.addEventListener('click', async () => {
    const firebaseModule = window.AppFirebase;
    if (!firebaseModule) {
      showToast("Firebase लोड होत आहे, कृपया १ सेकंद थांबा...", true);
      return;
    }

    const user = firebaseModule.getUser();
    if (!user) {
      try {
        await firebaseModule.signInWithGoogle();
        await firebaseModule.backupUserDataToCloud();
        showToast("Google लॉगिन यशस्वी व डेटा सिंक झाला! ☁️");
      } catch (err) {
        if (err.code === 'auth/unauthorized-domain') {
          showToast("Firebase Error: कृपया Firebase Console मध्ये हे Domain 'Authorized Domains' मध्ये ॲड करा.", true);
        } else {
          showToast(err.message || "लॉगिन त्रुटी", true);
        }
      }
    } else {
      try {
        await firebaseModule.backupUserDataToCloud();
        showToast("क्लाउड डेटा सिंक यशस्वी! ✓");
      } catch (e) {
        showToast("सिंक अयशस्वी", true);
      }
    }
  });

  // Feedback Modal Controls
  document.getElementById('btnOpenFeedbackModal')?.addEventListener('click', openFeedbackModal);
  document.getElementById('btnCloseFeedbackModal')?.addEventListener('click', closeFeedbackModal);

  document.getElementById('fbTypeGeneral')?.addEventListener('click', () => {
    DashboardState.feedbackType = 'General Feedback';
    const btnGen = document.getElementById('fbTypeGeneral');
    const btnRep = document.getElementById('fbTypeReport');
    if (btnGen) btnGen.className = "py-2 px-3 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 transition-all text-center";
    if (btnRep) btnRep.className = "py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all text-center";
    document.getElementById('fbInputQuestionId')?.classList.add('hidden');
  });

  document.getElementById('fbTypeReport')?.addEventListener('click', () => {
    DashboardState.feedbackType = 'Filter & Syllabus Query';
    const btnRep = document.getElementById('fbTypeReport');
    const btnGen = document.getElementById('fbTypeGeneral');
    if (btnRep) btnRep.className = "py-2 px-3 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 transition-all text-center";
    if (btnGen) btnGen.className = "py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all text-center";
    document.getElementById('fbInputQuestionId')?.classList.remove('hidden');
  });

  document.getElementById('btnSubmitFeedback')?.addEventListener('click', handleFeedbackSubmit);

  // Donate Modal Controls
  const triggerDonate = () => {
    drawer?.classList.add('hidden');
    const donateModal = document.getElementById('donateModal');
    donateModal?.classList.remove('hidden');
    donateModal?.classList.add('flex');
    setDonationAmount(100);
  };

  document.getElementById('btnTriggerDonate')?.addEventListener('click', triggerDonate);
  document.getElementById('btnTriggerDonateFromMenu')?.addEventListener('click', triggerDonate);

  document.getElementById('btnCloseDonateModal')?.addEventListener('click', () => {
    const donateModal = document.getElementById('donateModal');
    donateModal?.classList.add('hidden');
    donateModal?.classList.remove('flex');
  });

  document.getElementById('btnCopyUpiId')?.addEventListener('click', () => {
    navigator.clipboard?.writeText("vikram.joshi9089@oksbi");
    showToast("✓ UPI ID क्लिपबोर्डवर कॉपी झाला!");
  });
  document.getElementById('btnMobilePayUPI')?.addEventListener('click', triggerMobileUPI);
  document.getElementById('customDonationAmount')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 10) {
      DashboardState.donationAmount = Math.round(val);
      updateDesktopQR();
    }
  });

  // Web Share API
  document.getElementById('btnTriggerShare')?.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickQuiz 2.0 | StudySphere MPSC सराव केंद्र',
          text: 'MPSC राज्यसेवा, गट ब व क परीक्षेसाठी दर्जेदार मोफत AI सराव चाचणी केंद्र.',
          url: window.location.href
        });
      } catch (err) {
        // user dismissed
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast("वेबसाईट लिंक कॉपी झाली!");
    }
  });
}

function resetFilterSubjectsForExam() {
  const f = DashboardState.tempFilter;
  const stageData = AppStorage.SYLLABUS_DATA[f.exam]?.stages?.[f.stage] || AppStorage.SYLLABUS_DATA['group-c'].stages['Prelims'];
  f.subjects = [stageData.compact?.[0] || 'सामान्य अध्ययन'];
  f.microTopics = [];
  renderFilterModalUI();
}

// -------------------------------------------------------------
// Toast Utility
// -------------------------------------------------------------
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toastNotification');
  const text = document.getElementById('toastMessage');
  const icon = document.getElementById('toastIcon');
  if (!toast || !text) return;

  text.textContent = msg;
  if (isError) {
    toast.className = "fixed bottom-6 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 transform translate-y-0 opacity-100 transition-all duration-300 bg-rose-950 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-rose-600";
    if (icon) {
      icon.textContent = '✕';
      icon.className = 'text-rose-400 text-sm';
    }
  } else {
    toast.className = "fixed bottom-6 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 transform translate-y-0 opacity-100 transition-all duration-300 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700 dark:border-slate-300";
    if (icon) {
      icon.textContent = '✓';
      icon.className = 'text-emerald-400 dark:text-emerald-600 text-sm';
    }
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
  }, 2600);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[SW] Registration failed:', err);
    });
  }
}
