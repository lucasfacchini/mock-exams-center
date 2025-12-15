const EXAM_KEY = "exam_progress";
let examsData = null;
let currentExam = null;
let state = null;

const homeView = document.getElementById("home");
const examView = document.getElementById("exam");
const examList = document.getElementById("exam-list");
const examListContainer = document.getElementById("exam-list-container");

const questionTitle = document.getElementById("question-title");
const answersEl = document.getElementById("answers");
const nextBtn = document.getElementById("next-btn");
const prevBtn = document.getElementById("prev-btn");
const revealBtn = document.getElementById("reveal-btn");

const progressText = document.getElementById("progress-text");
const scoreText = document.getElementById("score-text");
const controlsEl = document.getElementById("controls");
const summaryEl = document.getElementById("summary");
const summaryCorrectEl = document.getElementById("summary-correct");
const summaryWrongEl = document.getElementById("summary-wrong");
const reviewBtn = document.getElementById("review-btn");
const reviewWrongBtn = document.getElementById("review-wrong-btn");
const resetBtn = document.getElementById("reset-btn");
const homeBtn = document.getElementById("home-btn");
const uploadPrompt = document.getElementById('upload-prompt');
const uploadBtn = document.getElementById('upload-btn');
const examsFileInput = document.getElementById('exams-file-input');
const uploadMsg = document.getElementById('upload-msg');
const clearUploadBtn = document.getElementById('clear-upload-btn');
const schemaPre = document.getElementById('schema-pre');
const loadSampleBtn = document.getElementById('load-sample-btn');

// Try to fetch exams.json from server. If it fails, try to load an uploaded copy from localStorage
fetch("exams.json")
  .then(res => {
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
  })
  .then(data => {
    examsData = data;
    loadHome();
  })
  .catch(err => {
    // attempt to use uploaded JSON saved in localStorage
    try {
      const saved = localStorage.getItem('uploaded_exams_json');
      if (saved) {
        examsData = JSON.parse(saved);
        loadHome();
        return;
      }
    } catch (e) {
      // fall through to prompt upload
    }
    // show upload prompt so user can provide exams.json
    showUploadPrompt();
  });

// Upload prompt handlers
function showUploadPrompt() {
  if (uploadPrompt) uploadPrompt.classList.remove('hidden');
  // hide the exam list container while prompting for upload
  try {
    if (examListContainer) examListContainer.style.display = 'none';
  } catch (e) {}
  // load and display the exams.json schema so users know the expected format
  if (schemaPre) {
    schemaPre.textContent = 'Loading schema…';
    fetch('exams.schema.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch schema');
        return res.text();
      })
      .then(text => {
        try {
          // try to pretty-print JSON if possible
          const obj = JSON.parse(text);
          schemaPre.textContent = JSON.stringify(obj, null, 2);
        } catch (e) {
          schemaPre.textContent = text;
        }
      })
      .catch(() => {
        schemaPre.textContent = 'Could not load exams.schema.json from the server.';
      });
  }
}

function hideUploadPrompt() {
  if (uploadPrompt) uploadPrompt.classList.add('hidden');
  if (uploadMsg) uploadMsg.textContent = '';
  if (schemaPre) schemaPre.textContent = '';
}

if (uploadBtn) {
  uploadBtn.onclick = () => {
    if (examsFileInput) examsFileInput.click();
  };
}

// Load the bundled sample exams JSON when the user requests it
if (loadSampleBtn) {
  loadSampleBtn.onclick = () => {
    if (uploadMsg) uploadMsg.textContent = 'Loading sample exams...';
    fetch('exams.sample.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch sample exams');
        return res.json();
      })
      .then(parsed => {
        if (!parsed || !Array.isArray(parsed.exams)) {
          if (uploadMsg) uploadMsg.textContent = 'Sample file appears invalid.';
          return;
        }
        // persist sample as uploaded so behavior matches uploaded flow
        localStorage.setItem('uploaded_exams_json', JSON.stringify(parsed));
        examsData = parsed;
        hideUploadPrompt();
        loadHome();
      })
      .catch(err => {
        if (uploadMsg) uploadMsg.textContent = 'Could not load sample exams.';
      });
  };
}

// Clear uploaded JSON from localStorage (top-bar button)
if (clearUploadBtn) {
  clearUploadBtn.onclick = () => {
    // remove uploaded exams data
    localStorage.removeItem('uploaded_exams_json');
    // also remove any per-exam progress keys that start with the EXAM_KEY prefix
    try {
      const prefix = `${EXAM_KEY}_`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    alert('Uploaded exams data and related progress cleared from localStorage. The app will reload.');
    location.reload();
  };
}

// (upload prompt clear button removed)

if (examsFileInput) {
  examsFileInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        // basic validation: must have exams array
        if (!parsed || !Array.isArray(parsed.exams)) {
          if (uploadMsg) uploadMsg.textContent = 'Invalid file: missing top-level "exams" array.';
          return;
        }
        // save uploaded JSON in localStorage for future loads
        localStorage.setItem('uploaded_exams_json', JSON.stringify(parsed));
        examsData = parsed;
        hideUploadPrompt();
        loadHome();
      } catch (err) {
        if (uploadMsg) uploadMsg.textContent = 'Invalid JSON file. Please select a valid exams.json.';
      }
    };
    reader.readAsText(file);
  };
}

function loadHome() {
  examList.innerHTML = "";
  examsData.exams.forEach(exam => {
    const div = document.createElement("div");
    div.className = "exam-card";
    div.textContent = `Mock Exam ${exam.exam_id} (${exam.questions.length} questions)`;
    // mark as finished if saved state says finalized
    try {
      const saved = localStorage.getItem(`${EXAM_KEY}_${exam.exam_id}`);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.finalized) {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = 'Completed';
          div.appendChild(badge);
        }
      }
    } catch (e) {}
    div.onclick = () => startExam(exam.exam_id);
    examList.appendChild(div);
  });

  // show or hide the Clear Uploaded button depending on whether there's uploaded data
  try {
    const hasUploaded = !!localStorage.getItem('uploaded_exams_json');
    if (clearUploadBtn) clearUploadBtn.style.display = hasUploaded ? '' : 'none';
  } catch (e) {}

  // show or hide the exam list container depending on whether there are exams
  updateExamListVisibility();
}

// Show or hide the exam list container based on whether exams exist
function updateExamListVisibility() {
  try {
    const hasExams = examsData && Array.isArray(examsData.exams) && examsData.exams.length > 0;
    if (examListContainer) examListContainer.style.display = hasExams ? '' : 'none';
  } catch (e) {}
}

function startExam(examId) {
  currentExam = examsData.exams.find(e => e.exam_id === examId);

  const saved = localStorage.getItem(`${EXAM_KEY}_${examId}`);
  state = saved ? JSON.parse(saved) : {
    examId,
    index: 0,
    answers: {},
    revealedQuestions: {},
    finalized: false
  };

  // migrate legacy `revealed` flag (was global) to per-question map
  if (state.revealed) {
    state.revealedQuestions = {};
    currentExam.questions.forEach(q => { state.revealedQuestions[q.id] = true; });
    delete state.revealed;
  }

  homeView.classList.add("hidden");
  examView.classList.remove("hidden");
  // if exam already finalized, show summary screen first
  if (state.finalized) {
    renderSummary();
  } else {
    renderQuestion();
  }
}

// Return to home screen (exam list)
if (homeBtn) {
  homeBtn.onclick = () => {
    examView.classList.add('hidden');
    homeView.classList.remove('hidden');
    // refresh exam list to reflect saved states (completed badges)
    loadHome();
  };
}

function renderQuestion() {
  const q = currentExam.questions[state.index];
  const isMulti = q.correct_answer_ids && q.correct_answer_ids.length > 1;
  questionTitle.textContent = q.question + (isMulti ? ' (Multiple Choice — select all that apply)' : '');
  answersEl.innerHTML = "";

  // ensure summary is hidden when rendering questions
  hideSummary();

  q.answers.forEach(a => {
    const li = document.createElement("li");

  // create visual input (checkbox for multiple, radio for single)
    const input = document.createElement("input");
    input.type = isMulti ? "checkbox" : "radio";
    input.name = `q_${q.id}`;
    input.id = `q_${q.id}_a_${a.id}`;
    input.onclick = (e) => { e.stopPropagation(); selectAnswer(a.id, li); };

    const span = document.createElement("span");
    span.textContent = a.text;

    // reflect saved state
    if (state.answers[q.id]?.includes(a.id)) {
      li.classList.add("selected");
      input.checked = true;
    }

    // append input and label
    li.appendChild(input);
    li.appendChild(span);

    // if answers have been revealed for this question, mark correct/incorrect and disable interaction
    if (state.revealedQuestions && state.revealedQuestions[q.id]) {
      const correctIds = q.correct_answer_ids || [];
      if (correctIds.includes(a.id)) {
        li.classList.add('correct');
      }
      if (state.answers[q.id]?.includes(a.id) && !correctIds.includes(a.id)) {
        li.classList.add('incorrect');
      }
      input.disabled = true;
      li.classList.add('disabled');
      // no click handler when revealed
      li.onclick = null;
    } else {
      li.onclick = () => selectAnswer(a.id, li);
    }

    answersEl.appendChild(li);
  });

  progressText.textContent =
    `Question ${state.index + 1} / ${currentExam.questions.length}`;

  // Update navigation controls
    if (prevBtn) prevBtn.disabled = state.index === 0;
    if (nextBtn) nextBtn.textContent = state.index === currentExam.questions.length - 1 ? 'Finish' : 'Next';

  if (revealBtn) revealBtn.disabled = !!(state.revealedQuestions && state.revealedQuestions[q.id]);

  // do not auto-show summary here; summary is shown explicitly when finalized
}

function selectAnswer(answerId, element) {
  // if this question's answers revealed, prevent changing selections
  const currentQ = currentExam.questions[state.index];
  if (state.revealedQuestions && state.revealedQuestions[currentQ.id]) return;

  const q = currentExam.questions[state.index];
  if (!state.answers[q.id]) state.answers[q.id] = [];
  const isMulti = q.correct_answer_ids && q.correct_answer_ids.length > 1;

  if (isMulti) {
    // toggle selection
    const idx = state.answers[q.id].indexOf(answerId);
    if (idx === -1) {
      state.answers[q.id].push(answerId);
      element.classList.add("selected");
      const inp = element.querySelector('input'); if (inp) inp.checked = true;
    } else {
      state.answers[q.id].splice(idx, 1);
      element.classList.remove("selected");
      const inp = element.querySelector('input'); if (inp) inp.checked = false;
      if (state.answers[q.id].length === 0) delete state.answers[q.id];
    }
  } else {
    // single selection (radio-like)
    state.answers[q.id] = [answerId];

    // clear all list item selections for this question
    Array.from(answersEl.children).forEach(li => {
      li.classList.remove("selected");
      const inp = li.querySelector('input'); if (inp) inp.checked = false;
    });

    element.classList.add("selected");
    const inp = element.querySelector('input'); if (inp) inp.checked = true;
  }

  saveState();

  // if this was the last question and it now has an answer, finalize and show score
  const lastIndex = currentExam.questions.length - 1;
  if (state.index === lastIndex && state.answers[q.id]) {
    state.finalized = true;
    saveState();
    renderSummary();
  } else if (!state.finalized) {
    hideSummary();
  }
}

nextBtn.onclick = () => {
  // if in a review-only (wrong) mode, advance within the dynamic list of wrong questions
  if (state.reviewMode === 'wrong') {
    const wrongIndices = getWrongIndices();
    if (wrongIndices.length === 0) {
      // nothing to review, go to summary
      state.finalized = true;
      saveState();
      renderSummary();
      return;
    }
    let pos = wrongIndices.indexOf(state.index);
    if (pos === -1) pos = 0; // if current index not in list, jump to first
    if (pos < wrongIndices.length - 1) {
      state.index = wrongIndices[pos + 1];
      saveState();
      renderQuestion();
      return;
    } else {
      // reached end -> finalize
      state.finalized = true;
      saveState();
      renderSummary();
      return;
    }
  }

  if (state.index < currentExam.questions.length - 1) {
    state.index++;
    saveState();
    renderQuestion();
  } else {
    // finalize and show summary
    state.finalized = true;
    saveState();
    renderSummary();
  }
};

// Go back to the previous question
prevBtn.onclick = () => {
  // if in a review-only (wrong) mode, move within the dynamic list of wrong questions
  if (state.reviewMode === 'wrong') {
    const wrongIndices = getWrongIndices();
    if (wrongIndices.length === 0) return;
    let pos = wrongIndices.indexOf(state.index);
    if (pos === -1) pos = 0;
    if (pos > 0) {
      state.index = wrongIndices[pos - 1];
      saveState();
      renderQuestion();
    }
    return;
  }

  if (state.index > 0) {
    state.index--;
    saveState();
    renderQuestion();
  }
};

// Reveal answers button
if (revealBtn) {
  revealBtn.onclick = () => {
    // mark only the current question as revealed
    if (!state.revealedQuestions) state.revealedQuestions = {};
    const q = currentExam.questions[state.index];
    state.revealedQuestions[q.id] = true;
    saveState();
    renderQuestion();
  };
}

// Summary rendering
function renderSummary() {
  // hide question UI and show summary
  if (summaryEl) summaryEl.classList.remove('hidden');
  if (questionTitle) questionTitle.classList.add('hidden');
  if (answersEl) answersEl.classList.add('hidden');
  if (controlsEl) controlsEl.classList.add('hidden');

  // compute exact counts and treat unanswered as wrong
  let correctCount = 0;
  let answeredCount = 0;
  const totalQuestions = currentExam.questions.length;
  currentExam.questions.forEach(q => {
    if (state.answers[q.id]) {
      answeredCount++;
      const correctIds = q.correct_answer_ids || [];
      if (
        correctIds.length === state.answers[q.id].length &&
        correctIds.every(id => state.answers[q.id].includes(id))
      ) {
        correctCount++;
      }
    }
  });
  const wrongCount = totalQuestions - correctCount; // unanswered counted as wrong

  if (summaryCorrectEl) summaryCorrectEl.textContent = correctCount;
  if (summaryWrongEl) summaryWrongEl.textContent = wrongCount;

  // show overall score based on total questions
  const pct = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  showScore(pct);

  // wire review and reset
  if (reviewBtn) {
    reviewBtn.onclick = () => {
      // hide summary and show question UI
      if (summaryEl) summaryEl.classList.add('hidden');
      if (questionTitle) questionTitle.classList.remove('hidden');
      if (answersEl) answersEl.classList.remove('hidden');
      if (controlsEl) controlsEl.classList.remove('hidden');
  // clear any review filter and start at the first question
  if (state.reviewList) delete state.reviewList;
  if (state.reviewPos) delete state.reviewPos;
  if (state.reviewMode) delete state.reviewMode;
  state.index = 0;
  saveState();
  renderQuestion();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      // clear saved state and restart
      localStorage.removeItem(`${EXAM_KEY}_${state.examId}`);
      state = {
        examId: state.examId,
        index: 0,
        answers: {},
        revealedQuestions: {},
        finalized: false
      };
      saveState();
      if (summaryEl) summaryEl.classList.add('hidden');
      if (questionTitle) questionTitle.classList.remove('hidden');
      if (answersEl) answersEl.classList.remove('hidden');
      if (controlsEl) controlsEl.classList.remove('hidden');
      renderQuestion();
    };
  }
  if (reviewWrongBtn) {
    reviewWrongBtn.onclick = () => {
      // compute initial wrong question indices (treat unanswered as wrong)
      const wrongIndices = [];
      currentExam.questions.forEach((q, idx) => {
        const selected = state.answers[q.id] || [];
        const correctIds = q.correct_answer_ids || [];
        const isCorrect = (
          correctIds.length === selected.length &&
          correctIds.every(id => selected.includes(id))
        );
        if (!isCorrect) wrongIndices.push(idx);
      });

      // if none wrong, just hide summary and show questions
      if (wrongIndices.length === 0) {
        if (summaryEl) summaryEl.classList.add('hidden');
        if (questionTitle) questionTitle.classList.remove('hidden');
        if (answersEl) answersEl.classList.remove('hidden');
        if (controlsEl) controlsEl.classList.remove('hidden');
        renderQuestion();
        return;
      }

      // enter review-wrong mode (transient)
      state.reviewMode = 'wrong';
      // jump to first wrong question
      state.index = wrongIndices[0];

      if (summaryEl) summaryEl.classList.add('hidden');
      if (questionTitle) questionTitle.classList.remove('hidden');
      if (answersEl) answersEl.classList.remove('hidden');
      if (controlsEl) controlsEl.classList.remove('hidden');
      renderQuestion();
    };
  }
  // hide navigation and reveal buttons while summary is visible
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  if (revealBtn) revealBtn.style.display = 'none';
}

function hideSummary() {
  if (summaryEl) summaryEl.classList.add('hidden');
  if (questionTitle) questionTitle.classList.remove('hidden');
  if (answersEl) answersEl.classList.remove('hidden');
  if (controlsEl) controlsEl.classList.remove('hidden');
  hideScore();
  // restore navigation and reveal buttons when hiding summary
  if (prevBtn) prevBtn.style.display = '';
  if (nextBtn) nextBtn.style.display = '';
  if (revealBtn) revealBtn.style.display = '';
  // clear any review-only state when leaving summary (so navigation is normal)
  if (state.reviewList) delete state.reviewList;
  if (state.reviewPos) delete state.reviewPos;
}

function calculateScore() {
  let correct = 0;
  let answered = 0;

  currentExam.questions.forEach(q => {
    if (state.answers[q.id]) {
      answered++;
      const correctIds = q.correct_answer_ids || [];
      if (
        correctIds.length === state.answers[q.id].length &&
        correctIds.every(id => state.answers[q.id].includes(id))
      ) {
        correct++;
      }
    }
  });

  const percent = answered ? Math.round((correct / answered) * 100) : 0;
  return percent;
}

function getWrongIndices() {
  const wrongIndices = [];
  currentExam.questions.forEach((q, idx) => {
    const selected = state.answers[q.id] || [];
    const correctIds = q.correct_answer_ids || [];
    const isCorrect = (
      correctIds.length === selected.length &&
      correctIds.every(id => selected.includes(id))
    );
    if (!isCorrect) wrongIndices.push(idx);
  });
  return wrongIndices;
}

function showScore(pct) {
  if (scoreText) scoreText.textContent = `Score: ${pct}%`;
}

function hideScore() {
  if (scoreText) scoreText.textContent = "";
}
// updateScore removed: score is only shown when user finalizes (answered last question)

function saveState() {
  localStorage.setItem(
    `${EXAM_KEY}_${state.examId}`,
    JSON.stringify(state)
  );
}
