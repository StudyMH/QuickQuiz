/**
 * StudySphere QuickQuiz 2.0 - Quiz Controller Engine
 * Features:
 * - Direct Gemini API integration with Multi-Model Fallback
 * - Devanagari Script Purity Validator
 * - Seamless Unlimited Background Buffering
 * - Vivid Loading Effect with Retry Handler
 * - MPSC 1/4th negative marking calculation
 * - Protected Review Mode (Read-only history navigation, no answer tampering)
 * - Save Whole Completed Quiz Set to Vault
 * - Hardware Back & Mobile Swipe-Back Interceptor
 * - Smart Scroll Management (Down to solution, Up on Next/Prev)
 */

const QuizState = {
  queue: [],
  currentQuestion: null,
  isAnswered: false,
  selectedOptionIndex: null,
  sessionHistory: [],
  historyIndex: -1,
  sessionStartTime: Date.now(),
  isFetching: false,
  isDemoActive: false,
  models: [
    'gemini-3.5-flash-lite',
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupQuizEventListeners();
  initBrowserBackGuard();
  initQuizArena();
});

// -------------------------------------------------------------
// Hardware Back, Mobile Swipe-Back & Backspace Interceptor
// -------------------------------------------------------------
function initBrowserBackGuard() {
  history.pushState({ page: 'quiz_active' }, '', window.location.href);

  window.addEventListener('popstate', () => {
    history.pushState({ page: 'quiz_active' }, '', window.location.href);
    const exitModal = document.getElementById('confirmExitModal');
    exitModal?.classList.remove('hidden');
    exitModal?.classList.add('flex');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        const exitModal = document.getElementById('confirmExitModal');
        exitModal?.classList.remove('hidden');
        exitModal?.classList.add('flex');
      }
    }
  });
}

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

function initQuizArena() {
  const apiKey = AppStorage.getGeminiKey();
  const isDemo = sessionStorage.getItem('qq_demo_active') === 'true';

  if (!apiKey && !isDemo) {
    window.location.replace('./index.html');
    return;
  }

  QuizState.isDemoActive = isDemo;
  const demoBadge = document.getElementById('badgeDemoIndicator');
  if (demoBadge) {
    demoBadge.classList.toggle('hidden', !isDemo);
  }

  const target = AppStorage.getExamTarget();
  const examMap = {
    'group-c': 'MPSC Combine गट क',
    'group-b': 'MPSC Combine गट ब',
    'rajyaseva': 'MPSC राज्यसेवा'
  };

  const targetExamDisplay = document.getElementById('targetExamDisplay');
  const targetSubjectDisplay = document.getElementById('targetSubjectDisplay');
  const badgeActiveLang = document.getElementById('badgeActiveLang');

  if (targetExamDisplay) targetExamDisplay.textContent = examMap[target.exam] || target.exam;
  if (targetSubjectDisplay) {
    const subText = Array.isArray(target.subjects) ? target.subjects.join(', ') : (target.subject || 'सामान्य अध्ययन');
    const microText = (target.syllabusMode === 'detailed' && Array.isArray(target.microTopics) && target.microTopics.length > 0)
      ? ` [घटक: ${target.microTopics.join(', ')}]`
      : '';
    targetSubjectDisplay.textContent = `${target.stage || 'पूर्व परीक्षा'} • ${subText}${microText}`;
  }

  if (badgeActiveLang) {
    badgeActiveLang.textContent = (target.lang === 'en') ? 'English' : 'मराठी';
  }

  const streakEl = document.getElementById('quizStreakCount');
  if (streakEl) streakEl.textContent = AppStorage.getStreak().toString();

  if (isDemo) {
    loadDemoQuestions();
  } else {
    fetchQuestionsBatch(true);
  }
}

function setupQuizEventListeners() {
  document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btnMainAction')?.addEventListener('click', handleMainAction);
  document.getElementById('btnPrevQuestion')?.addEventListener('click', handlePrevAction);
  document.getElementById('btnShowSolutionManual')?.addEventListener('click', handleShowSolutionManual);
  document.getElementById('btnSaveVault')?.addEventListener('click', handleToggleSaveVault);
  document.getElementById('btnFinishQuiz')?.addEventListener('click', handleFinishQuiz);
  document.getElementById('btnSaveWholeQuiz')?.addEventListener('click', handleSaveWholeQuizToVault);
  document.getElementById('btnFullRetryFetch')?.addEventListener('click', () => fetchQuestionsBatch(true));
  
  document.getElementById('btnCloseResultModal')?.addEventListener('click', () => {
    const modal = document.getElementById('resultModal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  });

  document.getElementById('btnTakeSnap')?.addEventListener('click', takeCleanQuestionSnapshot);

  document.getElementById('btnQuizHomeNav')?.addEventListener('click', () => {
    const exitModal = document.getElementById('confirmExitModal');
    exitModal?.classList.remove('hidden');
    exitModal?.classList.add('flex');
  });

  document.getElementById('btnCancelExit')?.addEventListener('click', () => {
    const exitModal = document.getElementById('confirmExitModal');
    exitModal?.classList.add('hidden');
    exitModal?.classList.remove('flex');
  });

  document.getElementById('btnConfirmExit')?.addEventListener('click', () => {
    window.location.href = './index.html';
  });

  document.getElementById('btnResultGoHome')?.addEventListener('click', () => {
    window.location.href = './index.html';
  });

  document.getElementById('btnDemoGoToAddKey')?.addEventListener('click', () => {
    sessionStorage.removeItem('qq_demo_active');
    window.location.href = './index.html?openKeyModal=true';
  });
}

// -------------------------------------------------------------
// 1. Script Purity & Schema Validator
// -------------------------------------------------------------
function validateMpscQuestion(q, targetLang = 'mr') {
  if (!q || typeof q !== 'object') return null;

  const qText = typeof q.question === 'object' ? (q.question[targetLang] || q.question.mr || q.question.en || '') : q.question;
  if (!qText || typeof qText !== 'string' || qText.trim().length === 0) return null;

  if (!Array.isArray(q.options) || q.options.length < 4) return null;

  if (typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) return null;

  const solText = typeof q.solution === 'object' ? (q.solution[targetLang] || q.solution.mr || q.solution.en || '') : q.solution;
  if (!solText || typeof solText !== 'string') return null;

  if (targetLang === 'en') {
    const devanagariPattern = /[\u0900-\u097F]/;
    if (devanagariPattern.test(qText) && qText.length > 15) {
      return null;
    }
  }

  if (q.questionType === 'match_pairs') {
    if (!q.matchPairs || !Array.isArray(q.matchPairs.colA) || !Array.isArray(q.matchPairs.colB)) {
      return null;
    }
    q.statements = null;
  } else if (q.questionType === 'multi_statement') {
    if (!Array.isArray(q.statements) || q.statements.length === 0) {
      return null;
    }
    q.matchPairs = null;
  } else {
    q.questionType = 'standard';
    q.statements = null;
    q.matchPairs = null;
  }

  const defaultConcluding = targetLang === 'en'
    ? "Which of the above statements is/are correct?"
    : "वरीलपैकी कोणते/ती विधाने बरोबर आहेत?";

  return {
    id: q.id || `MPSC_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    subject: String(q.subject || 'General Studies').trim(),
    topic: String(q.topic || 'MPSC Topic').trim(),
    difficulty: String(q.difficulty || 'Medium').trim(),
    isPYQ: Boolean(q.isPYQ),
    year: q.year || 2023,
    questionType: q.questionType,
    question: qText.trim(),
    matchPairs: q.matchPairs,
    statements: q.statements,
    concludingPrompt: q.concludingPrompt || defaultConcluding,
    options: q.options.slice(0, 4).map(opt => typeof opt === 'object' ? String(opt[targetLang] || opt.en || opt.mr || '').trim() : String(opt).trim()),
    correctAnswerIndex: q.correctAnswerIndex,
    solution: solText.trim(),
    reference: String(q.reference || q.solution?.reference || (targetLang === 'en' ? 'MPSC Official Reference' : 'MPSC अधिकृत संदर्भ')).trim()
  };
}

// -------------------------------------------------------------
// 2. AI Prompt Formulation
// -------------------------------------------------------------
function constructMpscPrompt(batchSize = 4) {
  const target = AppStorage.getExamTarget();
  const lang = target.lang || 'mr';
  const examKey = target.exam || 'group-c';
  const stage = target.stage || 'Prelims';
  const mode = target.syllabusMode || 'compact';

  let subjectFocus = Array.isArray(target.subjects) && target.subjects.length > 0
    ? target.subjects.join(', ')
    : 'महाराष्ट्राचा इतिहास व भूगोल';

  let microFocus = '';
  if (mode === 'detailed' && Array.isArray(target.microTopics) && target.microTopics.length > 0) {
    microFocus = `\nCRITICAL SUB-TOPIC FOCUS: [${target.microTopics.join(', ')}]. Generate questions strictly testing these specific topics.`;
  }

  let examGuidelines = '';
  if (examKey === 'rajyaseva') {
    examGuidelines = 'Level: MPSC Rajyaseva (Class 1/2). High conceptual depth, constitutional articles, comparative evaluations, multi-statement logic.';
  } else if (examKey === 'group-b') {
    examGuidelines = 'Level: MPSC Combine Group B. Factual accuracy, 2011 census data, state acts (RTI 2005, RTS 2015), exact historical dates, match pairs.';
  } else {
    examGuidelines = 'Level: MPSC Combine Group C. High standard board textbooks (8th-12th std), PYQ patterns, factual clarity.';
  }

  let languageDirective = "";
  if (lang === 'en') {
    languageDirective = `STRICT LANGUAGE REQUIREMENT: 100% ENGLISH ONLY.
- The question, all statements, match pairs, all 4 options, concludingPrompt, solution, and reference MUST BE IN PURE ENGLISH.
- DO NOT use any Devanagari (Marathi) words or labels like 'अ', 'ब', 'क', 'ड' or 'पर्याय'.
- In multi_statement, use English labels: "A", "B", "C", "D".
- concludingPrompt MUST be: "Which of the above statements is/are correct?" or "Which of the statements given above is/are incorrect?"`;
  } else {
    languageDirective = `STRICT LANGUAGE REQUIREMENT: 100% MARATHI IN PURE DEVANAGARI SCRIPT ONLY.
- The question, statements, options, solution, and reference MUST BE IN FLAWLESS MARATHI (शुद्ध देवनागरी).
- DO NOT mix random English sentences or corrupted Unicode characters.
- In multi_statement, use Marathi labels: "अ", "ब", "क", "ड".
- concludingPrompt MUST be: "वरीलपैकी कोणते/ती विधाने बरोबर आहेत?"`;
  }

  const entropy = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

  return `You are the chief question paper setter for the Maharashtra Public Service Commission (MPSC).
Generate exactly ${batchSize} authentic, factually accurate MPSC practice multiple-choice questions.

SPECIFICATIONS:
- Target Exam: ${target.exam} | Stage: ${stage} | Mode: ${mode.toUpperCase()}
- Subject Focus: ${subjectFocus} ${microFocus}
- Difficulty: ${target.diff || 'Medium'} (MPSC Standard) | Seed: ${entropy}
- ${languageDirective}
- ${examGuidelines}

CRITICAL RULES FOR QUESTION FORMATS:
1. Support standard, multi-statement, or match-pairs formats.
2. In 'multi_statement':
   - "statements" MUST contain array: [{"label": "${lang === 'en' ? 'A' : 'अ'}", "text": "..."}, {"label": "${lang === 'en' ? 'B' : 'ब'}", "text": "..."}].
   - "concludingPrompt" must match the selected language exactly.
   - "matchPairs" must be null.
3. In 'match_pairs':
   - "matchPairs" MUST provide {"colA": ["...", "...", "...", "..."], "colB": ["...", "...", "...", "..."]}.
   - "statements" must be null.
4. Output STRICTLY as a JSON array matching this exact schema:
[
  {
    "id": "MPSC_${Date.now()}_1",
    "subject": "${subjectFocus.split(',')[0].trim()}",
    "topic": "Specific Topic Name",
    "difficulty": "${target.diff || 'Medium'}",
    "isPYQ": true,
    "year": 2023,
    "questionType": "multi_statement",
    "question": "${lang === 'en' ? 'Question text in English' : 'प्रश्न मजकूर मराठीत'}",
    "matchPairs": null,
    "statements": [
      { "label": "${lang === 'en' ? 'A' : 'अ'}", "text": "${lang === 'en' ? 'Statement 1 in English' : 'विधान १'}" },
      { "label": "${lang === 'en' ? 'B' : 'ब'}", "text": "${lang === 'en' ? 'Statement 2 in English' : 'विधान २'}" }
    ],
    "concludingPrompt": "${lang === 'en' ? 'Which of the above statements is/are correct?' : 'वरीलपैकी कोणते/ती विधाने बरोबर आहेत?'}",
    "options": ["${lang === 'en' ? 'Option 1' : 'पर्याय १'}", "${lang === 'en' ? 'Option 2' : 'पर्याय २'}", "${lang === 'en' ? 'Option 3' : 'पर्याय ३'}", "${lang === 'en' ? 'Option 4' : 'पर्याय ४'}"],
    "correctAnswerIndex": 0,
    "solution": "${lang === 'en' ? 'Detailed analysis and explanation in English' : 'सविस्तर विश्लेषण व कारणमीमांसा'}",
    "reference": "${lang === 'en' ? 'MPSC Reference' : 'संदर्भ पुस्तक / शासन निर्णय'}"
  }
]`;
}

// -------------------------------------------------------------
// 3. Streaming & Auto-Buffering Engine
// -------------------------------------------------------------
async function fetchQuestionsBatch(isInitialLoad = false) {
  if (QuizState.isFetching || QuizState.isDemoActive) return;
  const apiKey = AppStorage.getGeminiKey();
  if (!apiKey) return;

  QuizState.isFetching = true;
  updateBufferStatusUI();

  const fullLoader = document.getElementById('quizFullScreenLoader');
  const fullRetry = document.getElementById('fullLoaderRetryArea');
  const mainBtn = document.getElementById('btnMainAction');
  const mainLabel = document.getElementById('mainActionLabel');
  const mainIcon = document.getElementById('mainActionIcon');

  if (isInitialLoad || QuizState.queue.length === 0) {
    if (fullLoader) {
      fullLoader.classList.remove('hidden');
      fullLoader.classList.add('flex');
    }
    if (fullRetry) fullRetry.classList.add('hidden');

    if (mainBtn && mainLabel) {
      mainBtn.disabled = true;
      mainLabel.textContent = "प्रश्न लोड होत आहे...";
      if (mainIcon) mainIcon.textContent = "⏳";
    }
  }

  const target = AppStorage.getExamTarget();
  const payload = {
    contents: [{ parts: [{ text: constructMpscPrompt(4) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
  };

  let success = false;
  for (const model of QuizState.models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        let validBatchCount = 0;
        parsed.forEach(rawQ => {
          const validQ = validateMpscQuestion(rawQ, target.lang || 'mr');
          if (validQ) {
            QuizState.queue.push(validQ);
            validBatchCount++;
          }
        });

        if (validBatchCount > 0) {
          success = true;
          break;
        }
      }
    } catch (e) {
      console.warn(`[AI] Model ${model} fetch failed, trying next...`, e);
    }
  }

  QuizState.isFetching = false;
  updateBufferStatusUI();

  if (success) {
    if (fullLoader) {
      fullLoader.classList.add('hidden');
      fullLoader.classList.remove('flex');
    }
    if (!QuizState.currentQuestion) {
      loadNextQuestion();
    } else {
      updateNavigationControls();
    }
  } else {
    if (QuizState.queue.length === 0 && !QuizState.currentQuestion) {
      if (fullLoader) {
        fullLoader.classList.remove('hidden');
        fullLoader.classList.add('flex');
      }
      if (fullRetry) fullRetry.classList.remove('hidden');
      const title = document.getElementById('fullLoaderTitle');
      const sub = document.getElementById('fullLoaderSubtitle');
      if (title) title.textContent = "AI संपर्क जोडताना अडचण आली किंवा API Key अवैध आहे.";
      if (sub) sub.textContent = "कृपया तुमची Gemini Key तपासा किंवा होमपेजवर जाऊन दुसरी मोफत Key जोडा.";

      if (mainBtn && mainLabel) {
        mainBtn.disabled = false;
        mainLabel.textContent = "पुन्हा प्रयत्न करा";
        if (mainIcon) mainIcon.textContent = "🔄";
      }
    } else {
      updateNavigationControls();
    }
  }
}

function updateBufferStatusUI() {
  const bufEl = document.getElementById('bufferCountText');
  if (bufEl) {
    bufEl.textContent = `तयार: ${QuizState.queue.length}`;
  }
}

// -------------------------------------------------------------
// 4. Question Rendering & Review Engine
// -------------------------------------------------------------
function loadNextQuestion() {
  if (QuizState.historyIndex !== -1) {
    QuizState.historyIndex++;
    if (QuizState.historyIndex < QuizState.sessionHistory.length) {
      const histItem = QuizState.sessionHistory[QuizState.historyIndex];
      QuizState.currentQuestion = histItem.question;
      QuizState.isAnswered = true;
      QuizState.selectedOptionIndex = histItem.selectedOptionIndex;
      renderCurrentQuestion(true);
      updateNavigationControls();
      return;
    } else {
      QuizState.historyIndex = -1;
    }
  }

  if (QuizState.isDemoActive && QuizState.queue.length === 0) {
    document.getElementById('quizQuestionBody')?.classList.add('hidden');
    document.getElementById('demoCompletedBox')?.classList.remove('hidden');
    
    document.getElementById('questionTagsRow')?.classList.add('opacity-30', 'pointer-events-none');
    document.getElementById('btnSaveVault')?.classList.add('opacity-30', 'pointer-events-none');
    document.getElementById('btnQuizHomeNav')?.classList.add('opacity-30', 'pointer-events-none');
    document.getElementById('btnTakeSnap')?.classList.add('opacity-30', 'pointer-events-none');
    document.getElementById('btnFinishQuiz')?.classList.add('opacity-30', 'pointer-events-none');

    document.getElementById('btnPrevQuestion')?.classList.add('hidden');
    document.getElementById('btnShowSolutionManual')?.classList.add('hidden');
    document.getElementById('btnMainAction')?.classList.add('hidden');
    return;
  }

  if (QuizState.queue.length === 0) {
    fetchQuestionsBatch(true);
    return;
  }

  QuizState.currentQuestion = QuizState.queue.shift();
  QuizState.isAnswered = false;
  QuizState.selectedOptionIndex = null;
  updateBufferStatusUI();

  renderCurrentQuestion(false);
  updateNavigationControls();

  if (QuizState.queue.length <= 1 && !QuizState.isFetching && !QuizState.isDemoActive) {
    fetchQuestionsBatch(false);
  }
}

function renderCurrentQuestion(isReviewMode = false) {
  const q = QuizState.currentQuestion;
  if (!q) return;

  const fullLoader = document.getElementById('quizFullScreenLoader');
  if (fullLoader) {
    fullLoader.classList.add('hidden');
    fullLoader.classList.remove('flex');
  }

  document.getElementById('quizQuestionBody')?.classList.remove('hidden');

  const subBadge = document.getElementById('badgeSubject');
  if (subBadge) subBadge.textContent = q.subject || 'MPSC';
  
  const diffBadge = document.getElementById('badgeDifficulty');
  if (diffBadge) diffBadge.textContent = q.difficulty || 'Medium';

  const pyqBadge = document.getElementById('badgePYQ');
  if (pyqBadge) {
    if (q.isPYQ) {
      pyqBadge.textContent = `🔥 PYQ ${q.year || ''}`;
      pyqBadge.classList.remove('hidden');
    } else {
      pyqBadge.classList.add('hidden');
    }
  }

  const typeBadge = document.getElementById('badgeQuestionType');
  if (typeBadge) {
    if (q.questionType === 'match_pairs') {
      typeBadge.textContent = "🎯 जोड्या जुळवा";
      typeBadge.classList.remove('hidden');
    } else if (q.questionType === 'multi_statement') {
      typeBadge.textContent = "📑 बहुविधान प्रश्न";
      typeBadge.classList.remove('hidden');
    } else {
      typeBadge.classList.add('hidden');
    }
  }

  const titleEl = document.getElementById('questionTitleText');
  if (titleEl) titleEl.textContent = q.question;

  const pairsContainer = document.getElementById('pairsContainer');
  if (pairsContainer) {
    pairsContainer.innerHTML = '';
    if (q.questionType === 'match_pairs' && q.matchPairs) {
      pairsContainer.classList.remove('hidden');
      const table = document.createElement('table');
      table.className = "pairs-table border border-slate-200 dark:border-slate-800 shadow-2xs";
      const tbody = document.createElement('tbody');

      const colA = q.matchPairs.colA || [];
      const colB = q.matchPairs.colB || [];
      const rowsCount = Math.max(colA.length, colB.length);

      for (let i = 0; i < rowsCount; i++) {
        const tr = document.createElement('tr');
        const tdA = document.createElement('td');
        tdA.className = "font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700/60 p-2 w-1/2";
        tdA.textContent = colA[i] || '';

        const tdB = document.createElement('td');
        tdB.className = "p-2 w-1/2 text-slate-700 dark:text-slate-300 font-medium";
        tdB.textContent = colB[i] || '';

        tr.appendChild(tdA);
        tr.appendChild(tdB);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      pairsContainer.appendChild(table);
    } else {
      pairsContainer.classList.add('hidden');
    }
  }

  const stContainer = document.getElementById('statementsContainer');
  const concludingEl = document.getElementById('concludingPrompt');
  if (stContainer) {
    stContainer.innerHTML = '';
    if (q.questionType === 'multi_statement' && Array.isArray(q.statements)) {
      stContainer.classList.remove('hidden');
      q.statements.forEach(st => {
        const row = document.createElement('div');
        row.className = "flex items-start gap-2 text-xs sm:text-[13px] leading-relaxed";

        const badge = document.createElement('span');
        badge.className = "w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-amber-300 dark:border-amber-800";
        badge.textContent = st.label || '';

        const text = document.createElement('p');
        text.className = "font-semibold text-slate-800 dark:text-slate-200";
        text.textContent = st.text || '';

        row.appendChild(badge);
        row.appendChild(text);
        stContainer.appendChild(row);
      });

      if (concludingEl) {
        concludingEl.textContent = q.concludingPrompt || "वरीलपैकी कोणते/ती विधाने बरोबर आहेत?";
        concludingEl.classList.remove('hidden');
      }
    } else {
      stContainer.classList.add('hidden');
      if (concludingEl) concludingEl.classList.add('hidden');
    }
  }

  const optionsContainer = document.getElementById('optionsContainer');
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.slice(0, 4).forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';

      let baseClasses = "opt-btn w-full text-left p-3 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between transition-all ";

      if (QuizState.isAnswered) {
        btn.disabled = true;
        if (idx === q.correctAnswerIndex) {
          baseClasses += "opt-correct border-emerald-500 shadow-xs";
        } else if (idx === QuizState.selectedOptionIndex) {
          baseClasses += "opt-wrong border-rose-500";
        } else {
          baseClasses += "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-40";
        }
      } else {
        baseClasses += "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-amber-500 active:scale-99";
        btn.onclick = () => handleSelectOption(idx);
      }

      btn.className = baseClasses;

      const leftPart = document.createElement('div');
      leftPart.className = "flex items-center gap-2.5 min-w-0";

      const badge = document.createElement('span');
      badge.className = "w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center shrink-0";
      badge.textContent = letters[idx];

      const label = document.createElement('span');
      label.className = "truncate";
      label.textContent = opt;

      leftPart.appendChild(badge);
      leftPart.appendChild(label);
      btn.appendChild(leftPart);

      if (QuizState.isAnswered && idx === q.correctAnswerIndex) {
        const check = document.createElement('span');
        check.className = "text-emerald-600 dark:text-emerald-400 font-black text-sm shrink-0";
        check.textContent = "✓";
        btn.appendChild(check);
      }

      optionsContainer.appendChild(btn);
    });
  }

  const solBox = document.getElementById('solutionBox');
  const solText = document.getElementById('solutionText');
  const solRef = document.getElementById('solutionReferenceBadge');
  const solRefRow = document.getElementById('solutionRefRow');
  const btnManualSol = document.getElementById('btnShowSolutionManual');

  if (QuizState.isAnswered) {
    if (solText) solText.textContent = q.solution || 'स्पष्टीकरण उपलब्ध नाही.';
    if (q.reference) {
      if (solRef) solRef.textContent = q.reference;
      solRefRow?.classList.remove('hidden');
    } else {
      solRefRow?.classList.add('hidden');
    }
    solBox?.classList.remove('hidden');
    btnManualSol?.classList.add('hidden');
  } else {
    solBox?.classList.add('hidden');
    btnManualSol?.classList.remove('hidden');
  }

  updateVaultButtonUI();
}

function handleSelectOption(selectedIndex) {
  if (QuizState.isAnswered) return;
  QuizState.isAnswered = true;
  QuizState.selectedOptionIndex = selectedIndex;

  const isCorrect = (selectedIndex === QuizState.currentQuestion.correctAnswerIndex);
  let currentStreak = AppStorage.getStreak();

  if (isCorrect) {
    currentStreak++;
    localStorage.setItem(AppStorage.KEYS.STREAK, currentStreak.toString());
    localStorage.setItem(AppStorage.KEYS.STREAK_LEGACY, currentStreak.toString());
  } else {
    currentStreak = 0;
    localStorage.setItem(AppStorage.KEYS.STREAK, '0');
    localStorage.setItem(AppStorage.KEYS.STREAK_LEGACY, '0');
  }
  const streakEl = document.getElementById('quizStreakCount');
  if (streakEl) streakEl.textContent = currentStreak.toString();

  const alreadyLogged = QuizState.sessionHistory.some(item => item.question.id === QuizState.currentQuestion.id);
  if (!alreadyLogged) {
    QuizState.sessionHistory.push({
      question: QuizState.currentQuestion,
      selectedOptionIndex: selectedIndex,
      isAnswered: true
    });
    AppStorage.writeJSON(AppStorage.KEYS.SESSION_HISTORY, QuizState.sessionHistory);
  }

  renderCurrentQuestion(false);
  updateNavigationControls();

  setTimeout(() => {
    const solBox = document.getElementById('solutionBox');
    if (solBox) {
      solBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
}

function handleShowSolutionManual() {
  if (!QuizState.currentQuestion || QuizState.isAnswered) return;
  QuizState.isAnswered = true;
  QuizState.selectedOptionIndex = -1;

  localStorage.setItem(AppStorage.KEYS.STREAK, '0');
  localStorage.setItem(AppStorage.KEYS.STREAK_LEGACY, '0');
  const streakEl = document.getElementById('quizStreakCount');
  if (streakEl) streakEl.textContent = '0';

  const alreadyLogged = QuizState.sessionHistory.some(item => item.question.id === QuizState.currentQuestion.id);
  if (!alreadyLogged) {
    QuizState.sessionHistory.push({
      question: QuizState.currentQuestion,
      selectedOptionIndex: -1,
      isAnswered: true
    });
    AppStorage.writeJSON(AppStorage.KEYS.SESSION_HISTORY, QuizState.sessionHistory);
  }

  renderCurrentQuestion(false);
  updateNavigationControls();

  setTimeout(() => {
    const solBox = document.getElementById('solutionBox');
    if (solBox) solBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// -------------------------------------------------------------
// 5. Instant Single-Tap Next Action Engine with Auto-Scroll Top
// -------------------------------------------------------------
function handleMainAction(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const mainBtn = document.getElementById('btnMainAction');
  const mainLabel = document.getElementById('mainActionLabel');
  const mainIcon = document.getElementById('mainActionIcon');

  if (QuizState.historyIndex !== -1) {
    loadNextQuestion();
    return;
  }

  if (!QuizState.isAnswered && QuizState.currentQuestion) {
    const alreadyLogged = QuizState.sessionHistory.some(item => item.question.id === QuizState.currentQuestion.id);
    if (!alreadyLogged) {
      QuizState.sessionHistory.push({
        question: QuizState.currentQuestion,
        selectedOptionIndex: -1,
        isAnswered: false
      });
      AppStorage.writeJSON(AppStorage.KEYS.SESSION_HISTORY, QuizState.sessionHistory);
    }
  }

  if (QuizState.queue.length === 0 && !QuizState.isDemoActive) {
    if (mainBtn && mainLabel) {
      mainBtn.disabled = true;
      mainLabel.textContent = "तयार होत आहे... ⏳";
      if (mainIcon) mainIcon.textContent = "⏳";
    }
    fetchQuestionsBatch(true);
    return;
  }

  loadNextQuestion();
}

function handlePrevAction() {
  if (QuizState.sessionHistory.length === 0) return;

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (QuizState.historyIndex === -1) {
    QuizState.historyIndex = QuizState.sessionHistory.length - 1;
  } else if (QuizState.historyIndex > 0) {
    QuizState.historyIndex--;
  } else {
    return;
  }

  const histItem = QuizState.sessionHistory[QuizState.historyIndex];
  if (histItem) {
    QuizState.currentQuestion = histItem.question;
    QuizState.isAnswered = true;
    QuizState.selectedOptionIndex = histItem.selectedOptionIndex;
    renderCurrentQuestion(true);
    updateNavigationControls();
  }
}

function updateNavigationControls() {
  const prevBtn = document.getElementById('btnPrevQuestion');
  if (prevBtn) {
    prevBtn.disabled = (QuizState.historyIndex === 0 || (QuizState.historyIndex === -1 && QuizState.sessionHistory.length === 0));
  }

  const mainBtn = document.getElementById('btnMainAction');
  const mainLabel = document.getElementById('mainActionLabel');
  const mainIcon = document.getElementById('mainActionIcon');

  if (mainBtn && mainLabel) {
    mainBtn.disabled = false;
    if (QuizState.historyIndex !== -1) {
      mainLabel.textContent = "पुढे चला (Review)";
      if (mainIcon) mainIcon.textContent = "→";
    } else if (QuizState.isAnswered) {
      mainLabel.textContent = "पुढील प्रश्न (Next)";
      if (mainIcon) mainIcon.textContent = "→";
    } else {
      mainLabel.textContent = "सोडून द्या (Skip)";
      if (mainIcon) mainIcon.textContent = "↷";
    }
  }
}

// -------------------------------------------------------------
// 6. Vault Management
// -------------------------------------------------------------
function handleToggleSaveVault() {
  if (!QuizState.currentQuestion) return;
  const vault = AppStorage.getVault();
  const qId = QuizState.currentQuestion.id;

  if (vault[qId]) {
    AppStorage.removeFromVault(qId);
    showToast("प्रश्नाचे जतन रद्द केले.");
  } else {
    AppStorage.saveToVault(QuizState.currentQuestion);
    showToast("✓ प्रश्न व्हॉल्टमध्ये सेव्ह केला!");
  }
  updateVaultButtonUI();
}

function updateVaultButtonUI() {
  if (!QuizState.currentQuestion) return;
  const vault = AppStorage.getVault();
  const isSaved = Boolean(vault[QuizState.currentQuestion.id]);
  const icon = document.getElementById('saveVaultIcon');
  const text = document.getElementById('saveVaultText');
  const btn = document.getElementById('btnSaveVault');

  if (isSaved) {
    if (icon) icon.textContent = '⭐';
    if (text) text.textContent = 'Saved';
    if (btn) btn.className = "h-7 px-2.5 rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1 transition-all";
  } else {
    if (icon) icon.textContent = '☆';
    if (text) text.textContent = 'Save';
    if (btn) btn.className = "h-7 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-400 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all";
  }
}

// -------------------------------------------------------------
// 7. Finish Quiz & MPSC 1/4th Scorecard
// -------------------------------------------------------------
function handleFinishQuiz() {
  const history = QuizState.sessionHistory;
  if (history.length === 0 && !QuizState.isAnswered) {
    showToast("कृपया आधी किमान १ प्रश्न सोडवा.", true);
    return;
  }

  if (QuizState.isAnswered && QuizState.currentQuestion) {
    const exists = history.some(item => item.question.id === QuizState.currentQuestion.id);
    if (!exists) {
      history.push({
        question: QuizState.currentQuestion,
        selectedOptionIndex: QuizState.selectedOptionIndex,
        isAnswered: true
      });
    }
  }

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  history.forEach(item => {
    if (item.selectedOptionIndex === -1 || item.selectedOptionIndex === null) {
      skippedCount++;
    } else if (item.selectedOptionIndex === item.question.correctAnswerIndex) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const totalAttempted = correctCount + wrongCount;
  const netScore = Math.max(0, (correctCount * 1.0) - (wrongCount * 0.25)).toFixed(2);
  const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
  const timeElapsedMin = Math.max(1, Math.round((Date.now() - QuizState.sessionStartTime) / 60000));

  const valEl = document.getElementById('scoreFinalValue');
  if (valEl) valEl.textContent = netScore;

  const accEl = document.getElementById('scoreAccuracyValue');
  if (accEl) accEl.textContent = `${accuracy}%`;

  const timeEl = document.getElementById('scoreTimeElapsed');
  if (timeEl) timeEl.textContent = `${timeElapsedMin} मि.`;

  const corEl = document.getElementById('scoreCorrectCount');
  if (corEl) corEl.textContent = correctCount.toString();

  const wrEl = document.getElementById('scoreWrongCount');
  if (wrEl) wrEl.textContent = wrongCount.toString();

  const skEl = document.getElementById('scoreSkippedCount');
  if (skEl) skEl.textContent = skippedCount.toString();

  const modal = document.getElementById('resultModal');
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

// -------------------------------------------------------------
// 8. Save Entire Test Paper to Vault
// -------------------------------------------------------------
function handleSaveWholeQuizToVault() {
  const target = AppStorage.getExamTarget();
  const testId = `TEST_${Date.now()}`;
  const scoreVal = document.getElementById('scoreFinalValue')?.textContent || '0';
  const testSummary = {
    id: testId,
    title: `${target.exam === 'rajyaseva' ? 'राज्यसेवा' : (target.exam === 'group-b' ? 'गट ब' : 'गट क')} सराव संच`,
    subject: Array.isArray(target.subjects) ? target.subjects.join(', ') : (target.subject || 'सामान्य अध्ययन'),
    date: new Date().toLocaleDateString('mr-IN'),
    score: scoreVal,
    totalQuestions: QuizState.sessionHistory.length,
    questions: QuizState.sessionHistory.map(h => h.question)
  };

  AppStorage.saveCompletedTest(testSummary);
  showToast("✓ संपूर्ण चाचणी संच डॅशबोर्डमध्ये सेव्ह झाला!");
  const btn = document.getElementById('btnSaveWholeQuiz');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "✓ चाचणी सेव्ह झाली आहे";
  }
}

// -------------------------------------------------------------
// 9. Clean Branded Snapshot Generator
// -------------------------------------------------------------
function takeCleanQuestionSnapshot() {
  const card = document.getElementById('quizCard');
  if (!card) return;

  showToast("ब्रँडेड स्क्रीनशॉट तयार होत आहे... 📸");

  const cloneWrapper = document.createElement('div');
  cloneWrapper.style.position = 'fixed';
  cloneWrapper.style.left = '-99999px';
  cloneWrapper.style.top = '0';
  const targetWidth = Math.min(Math.max(card.offsetWidth, 480), 720);
  cloneWrapper.style.width = `${targetWidth}px`;
  cloneWrapper.style.boxSizing = 'border-box';
  cloneWrapper.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#090d16' : '#ffffff';
  cloneWrapper.style.padding = '20px';
  cloneWrapper.style.borderRadius = '20px';
  cloneWrapper.style.fontFamily = '"Plus Jakarta Sans", "Mukta", sans-serif';
  cloneWrapper.style.overflow = 'visible';

  const brandHeader = document.createElement('div');
  brandHeader.style.display = 'flex';
  brandHeader.style.alignItems = 'center';
  brandHeader.style.justifyContent = 'space-between';
  brandHeader.style.paddingBottom = '12px';
  brandHeader.style.marginBottom = '14px';
  brandHeader.style.borderBottom = '2px solid #f59e0b';

  const target = AppStorage.getExamTarget();
  const examName = target.exam === 'rajyaseva' ? 'MPSC राज्यसेवा' : (target.exam === 'group-b' ? 'MPSC Combine गट ब' : 'MPSC Combine गट क');

  brandHeader.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#d97706;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;">Q</div>
      <div>
        <div style="font-weight:900;font-size:15px;color:${document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a'};text-transform:uppercase;letter-spacing:0.5px;">QuickQuiz 2.0</div>
        <div style="font-size:11px;font-weight:700;color:#64748b;">StudySphere • MPSC सराव केंद्र</div>
      </div>
    </div>
    <div style="text-align:right;">
      <span style="font-size:11px;font-weight:800;background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:8px;border:1px solid #fde68a;">${examName}</span>
      <div style="font-size:10px;color:#94a3b8;font-weight:700;margin-top:3px;">t.me/MPSCstudysphere</div>
    </div>
  `;

  const clonedCard = card.cloneNode(true);
  clonedCard.style.boxShadow = 'none';
  clonedCard.style.border = '1px solid #e2e8f0';
  clonedCard.style.overflow = 'visible';
  clonedCard.style.height = 'auto';

  clonedCard.querySelectorAll('*').forEach(el => {
    el.style.overflow = 'visible';
    el.style.wordBreak = 'break-word';
  });

  const brandFooter = document.createElement('div');
  brandFooter.style.marginTop = '14px';
  brandFooter.style.textAlign = 'center';
  brandFooter.style.fontSize = '10px';
  brandFooter.style.fontWeight = '700';
  brandFooter.style.color = '#94a3b8';
  brandFooter.textContent = "🎯 तयारी यशाची | QuickQuiz by StudySphere";

  cloneWrapper.appendChild(brandHeader);
  cloneWrapper.appendChild(clonedCard);
  cloneWrapper.appendChild(brandFooter);
  document.body.appendChild(cloneWrapper);

  html2canvas(cloneWrapper, {
    scale: 2,
    useCORS: true,
    scrollY: 0,
    scrollX: 0,
    windowWidth: targetWidth,
    backgroundColor: document.documentElement.classList.contains('dark') ? '#090d16' : '#ffffff'
  }).then(canvas => {
    document.body.removeChild(cloneWrapper);
    const link = document.createElement('a');
    link.download = `QuickQuiz_MPSC_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast("✓ हेडरसह स्क्रीनशॉट गॅलरीमध्ये सेव्ह झाला!");
  }).catch(() => {
    if (document.body.contains(cloneWrapper)) document.body.removeChild(cloneWrapper);
    showToast("स्क्रीनशॉट घेताना अडचण आली.", true);
  });
}

// -------------------------------------------------------------
// 10. Demo Questions Set
// -------------------------------------------------------------
function loadDemoQuestions() {
  QuizState.queue = [
    {
      id: "DEMO_1",
      subject: "भूगोल",
      topic: "महाराष्ट्रातील नद्या व संगम",
      difficulty: "Medium",
      isPYQ: true,
      year: 2022,
      questionType: "match_pairs",
      question: "महाराष्ट्रातील प्रसिद्ध नदी संगम व त्यांची ठिकाणे यांसंदर्भात योग्य जोड्या जुळवा:",
      matchPairs: {
        colA: ["अ. प्रकाशे", "ब. मुडावद", "क. माहूली", "ड. तुळापूर"],
        colB: ["I. तापी-गोमती", "II. तापी-पांझरा", "III. कृष्णा-वेण्णा", "IV. भीमा-इंद्रायणी"]
      },
      options: [
        "अ-I, ब-II, क-III, ड-IV",
        "अ-II, ब-I, क-IV, ड-III",
        "अ-IV, ब-III, क-II, ड-I",
        "अ-I, ब-III, क-II, ड-IV"
      ],
      correctAnswerIndex: 0,
      solution: "अचूक जुळणी:\n• प्रकाशे (नंदुरबार) = तापी व गोमती नदी संगम.\n• मुडावद (धुळे) = तापी व पांझरा नदी संगम.\n• माहूली (सातारा) = कृष्णा व वेण्णा संगम.\n• तुळापूर (पुणे) = भीमा व इंद्रायणी संगम.",
      reference: "महाराष्ट्र स्टेट बोर्ड इ. ९ वी भूगोल"
    },
    {
      id: "DEMO_2",
      subject: "इतिहास",
      topic: "गोपाळ हरी देशमुख (शतपत्रे)",
      difficulty: "Hard",
      isPYQ: true,
      year: 2021,
      questionType: "multi_statement",
      question: "गोपाळ हरी देशमुख (लोकहितवादी) यांच्या शतपत्रांच्या संदर्भात खालील विधाने विचारात घ्या:",
      statements: [
        { label: "अ", text: "ही शतपत्रे 'प्रभाकर' या साप्ताहिकात १८४८ ते १८५० दरम्यान प्रसिद्ध झाली." },
        { label: "ब", text: "त्यांनी आधुनिक वैज्ञानिक दृष्टिकोनाचे स्वागत केले व सामाजिक रूढींवर प्रहार केला." },
        { label: "क", text: "शतपत्रांची एकूण संख्या १०० होती." }
      ],
      concludingPrompt: "वरीलपैकी कोणते/ती विधाने बरोबर आहेत?",
      options: [
        "सर्व विधाने बरोबर आहेत",
        "फक्त विधान 'अ' आणि 'ब' बरोबर आहे",
        "फक्त विधान 'ब' आणि 'क' बरोबर आहे",
        "सर्व विधाने चूक आहेत"
      ],
      correctAnswerIndex: 0,
      solution: "शतपत्रे ही प्रभाकर साप्ताहिकात भाऊ महाजन यांच्या संपादकत्वाखाली १८४८ ते १८५० दरम्यान प्रकाशित झाली. लोकहितवादींनी यातून अंधश्रद्धा व सामाजिक कुप्रथांवर प्रहार केला.",
      reference: "MPSC आधुनिक महाराष्ट्राचा इतिहास"
    }
  ];

  loadNextQuestion();
  showToast("डेमो मोड सक्रिय! २ आदर्श प्रश्न उपलब्ध.");
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
  }, 2500);
}