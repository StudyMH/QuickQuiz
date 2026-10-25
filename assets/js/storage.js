/**
 * QuickQuiz 2.0 Centralized Local-First Storage Abstraction
 * Preserves backward compatibility with existing localStorage keys
 */
const AppStorage = (() => {
  const KEYS = {
    VAULT: 'studySphereVault',
    SAVED_QUESTIONS: 'studySphere_saved_questions',
    SAVED_TESTS: 'qq_saved_tests',
    API_KEY: 'studySphere_gemini_key',
    API_KEY_LEGACY: 'gemini_api_key',
    TARGET_FILTERS: 'qq_saved_filters',
    TARGET_LEGACY: 'qq_target',
    STREAK: 'qq_correct_streak',
    STREAK_LEGACY: 'qq_streak',
    SESSION_HISTORY: 'qq_session_history',
    THEME: 'theme',
    LANG: 'qq_selected_lang',
    USER_PROFILE: 'qq_user_profile'
  };

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[AppStorage] Failed reading JSON key "${key}":`, e);
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error(`[AppStorage] Storage quota exceeded or error writing "${key}":`, e);
      return false;
    }
  }

  // 1. Vault & Saved Questions Management (Backward compatible)
  function getVault() {
    const primary = readJSON(KEYS.VAULT, null);
    if (primary && typeof primary === 'object') return primary;

    const legacy = readJSON(KEYS.SAVED_QUESTIONS, {});
    return legacy && typeof legacy === 'object' ? legacy : {};
  }

  function saveToVault(question) {
    if (!question || !question.id) return false;
    const vault = getVault();
    vault[question.id] = question;
    return writeJSON(KEYS.VAULT, vault);
  }

  function removeFromVault(id) {
    if (!id) return false;
    const vault = getVault();
    if (vault[id]) {
      delete vault[id];
      return writeJSON(KEYS.VAULT, vault);
    }
    return true;
  }

  // 1B. Saved Entire Test Papers (Full Quiz Sets)
  function getSavedTests() {
    return readJSON(KEYS.SAVED_TESTS, []);
  }

  function saveCompletedTest(testSummary) {
    if (!testSummary || !testSummary.id) return false;
    const tests = getSavedTests();
    tests.unshift(testSummary);
    if (tests.length > 50) tests.pop(); // keep latest 50 tests
    return writeJSON(KEYS.SAVED_TESTS, tests);
  }

  // 2. Exam Target & Filters
  function getExamTarget() {
    const filters = readJSON(KEYS.TARGET_FILTERS, null);
    if (filters) return filters;
    return readJSON(KEYS.TARGET_LEGACY, {
      exam: 'group-c',
      stage: 'Prelims',
      syllabusMode: 'compact', // 'compact' or 'detailed'
      subjects: ['महाराष्ट्राचा इतिहास'],
      microTopics: [],
      diff: 'Medium',
      lang: 'mr'
    });
  }

  function setExamTarget(filters) {
    writeJSON(KEYS.TARGET_FILTERS, filters);
    writeJSON(KEYS.TARGET_LEGACY, filters);
  }

  // -------------------------------------------------------------
  // MPSC Complete Syllabus Hierarchy Tree (Based on Official Scheme)
  // -------------------------------------------------------------
  const SYLLABUS_DATA = {
    'rajyaseva': {
      name: 'MPSC राज्यसेवा (Rajyaseva)',
      stages: {
        'Prelims': {
          compact: [
            'इतिहास (भारत व महाराष्ट्र)',
            'भूगोल (महाराष्ट्र, भारत व जग)',
            'भारतीय राज्यव्यवस्था व शासन',
            'आर्थिक व सामाजिक विकास',
            'पर्यावरण, जैवविविधता व हवामान बदल',
            'सामान्य विज्ञान',
            'चालू घडामोडी',
            'CSAT (आकलन व तर्कक्षमता)'
          ],
          detailed: [
            { category: 'General Studies (Paper 1)', topics: ['History of India & Maharashtra', 'Indian National Movement', 'Physical, Social & Economic Geography', 'Maharashtra Geography & Natural Resources', 'Indian Polity, Constitution & Governance', 'Panchayati Raj & Urban Administration', 'Sustainable Development & Poverty', 'Biodiversity, Ecology & Climate Change', 'General Science (Physics, Chem, Bio)'] },
            { category: 'CSAT (Paper 2)', topics: ['Comprehension (मराठी व इंग्रजी उतारा)', 'Logical Reasoning & Analytical Ability', 'Decision Making & Problem Solving', 'General Mental Ability', 'Basic Numeracy & Data Interpretation'] }
          ]
        },
        'Mains': {
          compact: [
            'Paper 1: मराठी भाषा',
            'Paper 2: इंग्रजी भाषा',
            'Paper 3: निबंध',
            'GS 1: इतिहास, भूगोल व कृषी',
            'GS 2: संविधान, राज्यव्यवस्था व कायदे',
            'GS 3: अर्थव्यवस्था व विज्ञान-तंत्रज्ञान',
            'GS 4: नीतीशास्त्र व मानवी मूल्ये'
          ],
          detailed: [
            { category: 'भाषा व निबंध', topics: ['मराठी व्याकरण, शब्दसंग्रह व निबंध', 'English Grammar, Vocab & Essay'] },
            { category: 'GS 1 (इतिहास व भूगोल)', topics: ['आधुनिक भारताचा इतिहास व १८५७ चा उठाव', 'महाराष्ट्राचा सामाजिक-सांस्कृतिक इतिहास', 'महाराष्ट्राचा प्राकृतिक व मानवी भूगोल', 'कृषी व मृदा व्यवस्थापन'] },
            { category: 'GS 2 (राज्यव्यवस्था व प्रशासन)', topics: ['भारतीय संविधान निर्मिती व ठळक वैशिष्ट्ये', 'संसद, राज्य विधिमंडळ व कार्यकारी मंडळ', 'न्यायव्यवस्था व न्यायालयीन सक्रियता', 'स्थानिक स्वराज्य संस्था व ७३-७४ वी घटनादुरुस्ती', 'निवडणूक प्रक्रिया व प्रशासकीय सुधारणा'] },
            { category: 'GS 3 (अर्थव्यवस्था व नियोजन)', topics: ['भारतीय अर्थव्यवस्था, दारिद्र्य व बेरोजगारी', 'बँकिंग, मौद्रिक धोरण व सार्वजनिक वित्त', 'महाराष्ट्र अर्थव्यवस्था व पायाभूत सुविधा', 'विज्ञान-तंत्रज्ञान, जैवतंत्रज्ञान व आपत्ती व्यवस्थापन'] },
            { category: 'GS 4 (नीतीशास्त्र)', topics: ['नीतीशास्त्र, मानवी मूल्ये व सचोटी', 'प्रशासनातील सत्यनिष्ठा व लोकसेवा मूल्ये', 'केस स्टडीज (प्रकरण अभ्यास)'] }
          ]
        }
      }
    },
    'group-b': {
      name: 'MPSC Combine गट ब (Group B)',
      stages: {
        'Prelims': {
          compact: [
            'इतिहास (आधुनिक भारत व महाराष्ट्र)',
            'भूगोल (महाराष्ट्र व भारत विशेष संदर्भासह)',
            'भारतीय राज्यघटना व शासन',
            'भारतीय व महाराष्ट्र अर्थव्यवस्था',
            'सामान्य विज्ञान (भौतिक, रसायन, जीव, आरोग्य)',
            'अंकगणित व बुद्धिमत्ता चाचणी',
            'चालू घडामोडी'
          ],
          detailed: [
            { category: 'इतिहास', topics: ['१८५७ चा उठाव व राष्ट्रीय चळवळ', 'महाराष्ट्रातील समाजसुधारक व त्यांचे कार्य', 'महाराष्ट्रातील सामाजिक जागृती व वृत्तपत्रे'] },
            { category: 'भूगोल', topics: ['महाराष्ट्राची प्राकृतिक रचना व नद्या', 'हवामान, पर्जन्य व वने', 'खनिजे, उद्योग व दळणवळण', 'महाराष्ट्र लोकसंख्या (२०११ जनगणना)'] },
            { category: 'राज्यघटना व प्रशासन', topics: ['संविधानाची निर्मिती, मूलभूत हक्क व मार्गदर्शक तत्त्वे', 'राष्ट्रपती, राज्यपाल, मुख्यमंत्री व मंत्रिमंडळ', 'ग्रामपंचायत, पंचायत समिती व जिल्हा परिषद', 'महानगरपालिका व नगरपरिषद'] },
            { category: 'अर्थव्यवस्था', topics: ['राष्ट्रीय उत्पन्न व आर्थिक सुधारणा (LPG)', 'दारिद्र्य, बेरोजगारी व शासकीय योजना', 'बँकिंग व्यवस्था, RBI व मौद्रिक धोरण', 'सार्वजनिक वित्त, कररचना व GST', 'परकीय व्यापार व आंतरराष्ट्रीय संस्था'] },
            { category: 'सामान्य विज्ञान', topics: ['भौतिकशास्त्र (Physics)', 'रसायनशास्त्र (Chemistry)', 'प्राणीशास्त्र व वनस्पतीशास्त्र (Zoology/Botany)', 'आरोग्यशास्त्र व पोषण (Hygiene & Diseases)'] },
            { category: 'अंकगणित व बुद्धिमत्ता', topics: ['संख्या मालिका व तर्कक्षमता', 'वेळ, वेग, अंतर व रेल्वे', 'नफा-तोटा, टक्केवारी व भागीदारी', 'आकृत्या व नातेसंबंध'] }
          ]
        },
        'Mains': {
          compact: [
            'Paper 1: मराठी भाषा व व्याकरण',
            'Paper 1: इंग्रजी भाषा व व्याकरण',
            'Paper 2: सामान्य अध्ययन व बुद्धिमत्ता',
            'कायदे: माहितीचा अधिकार (RTI 2005)',
            'कायदे: लोकसेवा हक्क अधिनियम (RTS 2015)',
            'संगणक व माहिती तंत्रज्ञान'
          ],
          detailed: [
            { category: 'मराठी भाषा', topics: ['मराठी व्याकरण (संधी, समास, अलंकार, काळ)', 'शब्दसंग्रह (समानार्थी, विरुद्धार्थी, म्हणी, वाक्प्रचार)', 'वाक्यपृथक्करण व शुद्धलेखन', 'उतारा आकलन'] },
            { category: 'English Language', topics: ['Grammar (Tenses, Voices, Prepositions)', 'Vocabulary (Synonyms, Antonyms, Idioms)', 'Sentence Correction & Spotting Errors', 'Comprehension Passage'] },
            { category: 'कायदे व प्रशासन', topics: ['माहितीचा अधिकार अधिनियम २००५', 'महाराष्ट्र लोकसेवा हक्क अधिनियम २०१५', 'भारतीय राज्यव्यवस्था व उच्च न्यायालय/सर्वोच्च न्यायालय'] },
            { category: 'पदनिहाय विशेष घटक (Legacy)', topics: ['PSI: पोलीस प्रशासन व मानवी हक्क', 'STI: महाराष्ट्र विक्रीकर, GST व करप्रणाली', 'ASO: मंत्रालयीन कामकाज व सचिवालयीन कार्यपद्धती'] }
          ]
        }
      }
    },
    'group-c': {
      name: 'MPSC Combine गट क (Group C)',
      stages: {
        'Prelims': {
          compact: [
            'इतिहास (महाराष्ट्र व भारत)',
            'भूगोल (महाराष्ट्र प्राथमिक संदर्भ)',
            'भारतीय राज्यघटना',
            'अर्थव्यवस्था (मूलभूत संकल्पना)',
            'सामान्य विज्ञान',
            'अंकगणित व बुद्धिमत्ता',
            'चालू घडामोडी'
          ],
          detailed: [
            { category: 'सामान्य अध्ययन', topics: ['महाराष्ट्राचा आधुनिक इतिहास व समाजसुधारक', 'महाराष्ट्राचे जिल्हे, नद्या, धरणे व वने', 'भारतीय संविधानाची मूलभूत रचना व नागरिकत्व', 'भारतीय अर्थव्यवस्था, शेती व उद्योग', 'दैनिक विज्ञान व मानवी आरोग्य'] },
            { category: 'अंकगणित व बुद्धिमत्ता', topics: ['सांख्यिकी, सरळव्याज व चक्रवाढव्याज', 'सरासरी, प्रमाण व भागीदारी', 'कोडिंग-डिकोडिंग व घड्याळ/दिनदर्शिका'] }
          ]
        },
        'Mains': {
          compact: [
            'मराठी व्याकरण व शब्दसंग्रह',
            'इंग्रजी व्याकरण व शब्दसंग्रह',
            'चालू घडामोडी व सामान्य ज्ञान',
            'माहितीचा अधिकार व लोकसेवा हक्क कायदा',
            'संगणक व माहिती तंत्रज्ञान'
          ],
          detailed: [
            { category: 'भाषा व सामान्य ज्ञान', topics: ['मराठी व इंग्रजी व्याकरण (इयत्ता १० वी / १२ वी स्तर)', 'माहिती तंत्रज्ञान व दैनिक संगणक वापर', 'RTI Act 2005 व लोकसेवा हक्क कायदा २०१५'] },
            { category: 'पदनिहाय विशेष घटक (Legacy)', topics: ['Tax Assistant: बहीखाते व लेखाकर्म (Bookkeeping & Accounts)', 'Clerk-Typist: कार्यालयीन टिप्पणी व टंकलेखन पद्धती', 'Excise Sub-Inspector: उत्पादन शुल्क कायदे', 'Industry Inspector: औद्योगिक धोरण व लघुउद्योग'] }
          ]
        }
      }
    }
  };

  // 3. Performance Metrics
  function getStreak() {
    const val = localStorage.getItem(KEYS.STREAK) || localStorage.getItem(KEYS.STREAK_LEGACY) || '0';
    return parseInt(val, 10) || 0;
  }

  function getSessionHistory() {
    return readJSON(KEYS.SESSION_HISTORY, []);
  }

  // 4. API Key Resolution
  function getGeminiKey() {
    return (localStorage.getItem(KEYS.API_KEY) || localStorage.getItem(KEYS.API_KEY_LEGACY) || '').trim();
  }

  function setGeminiKey(key) {
    if (key) {
      localStorage.setItem(KEYS.API_KEY, key.trim());
      localStorage.setItem(KEYS.API_KEY_LEGACY, key.trim());
    } else {
      localStorage.removeItem(KEYS.API_KEY);
      localStorage.removeItem(KEYS.API_KEY_LEGACY);
    }
  }

  // 5. Theme & Language
  function getTheme() {
    return localStorage.getItem(KEYS.THEME) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(theme) {
    localStorage.setItem(KEYS.THEME, theme);
  }

  return {
    KEYS,
    SYLLABUS_DATA,
    readJSON,
    writeJSON,
    getVault,
    saveToVault,
    removeFromVault,
    getSavedTests,
    saveCompletedTest,
    getExamTarget,
    setExamTarget,
    getStreak,
    getSessionHistory,
    getGeminiKey,
    setGeminiKey,
    getTheme,
    setTheme
  };
})();