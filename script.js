const API_URL = "https://opentdb.com/api.php";

const $ = (selector) => document.querySelector(selector);

const screens = {
  setup: $("#setup"),
  game: $("#game"),
  result: $("#result"),
  loading: $("#loading"),
  error: $("#error")
};

const game = {
  questions: [],
  index: 0,
  score: 0,
  correct: 0,
  wrong: 0,
  answered: false,
  pointsEarned: [],
  settings: null
};

const difficultyNames = {
  easy: "Fácil",
  medium: "Intermedia",
  hard: "Difícil"
};

const pointsByDifficulty = {
  easy: 10,
  medium: 20,
  hard: 30
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
}

function decodeHTML(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function updatePointsPreview() {
  const difficulty = $("#difficulty").value;

  if (difficulty) {
    $("#points-preview").textContent =
      `${pointsByDifficulty[difficulty]} puntos por acierto`;
  } else {
    $("#points-preview").textContent =
      "10, 20 o 30 puntos según la dificultad";
  }
}

$("#difficulty").addEventListener("change", updatePointsPreview);

function showError(text) {
  $("#error-message").textContent = text;
  showScreen("error");
}

async function startGame() {
  const amount = Number($("#amount").value);
  const difficulty = $("#difficulty").value;
  const category = $("#category").value;
  const type = $("#type").value;

  game.settings = { amount, difficulty, category, type };
  game.questions = [];
  game.index = 0;
  game.score = 0;
  game.correct = 0;
  game.wrong = 0;
  game.answered = false;
  game.pointsEarned = [];

  showScreen("loading");

  const params = new URLSearchParams({
    amount: String(amount),
    type,
    encode: "default"
  });

  if (category) params.set("category", category);
  if (difficulty) params.set("difficulty", difficulty);

  try {
    const response = await fetch(`${API_URL}?${params}`);

    if (response.status === 429) {
      throw new Error(
        "La API está recibiendo demasiadas solicitudes. Espera unos segundos antes de intentarlo de nuevo."
      );
    }

    if (!response.ok) {
      throw new Error("No se pudo conectar con el servidor de preguntas.");
    }

    const data = await response.json();

    if (data.response_code !== 0 || !data.results?.length) {
      if (data.response_code === 1) {
        throw new Error(
          "No hay suficientes preguntas para esa combinación de filtros. Prueba otra categoría o dificultad."
        );
      }

      if (data.response_code === 5) {
        throw new Error(
          "Has realizado demasiadas consultas. Espera unos segundos e inténtalo de nuevo."
        );
      }

      throw new Error(
        "No se pudieron obtener preguntas. Prueba otra configuración."
      );
    }

    game.questions = data.results.map((question) => {
      const correctAnswer = decodeHTML(question.correct_answer);

      const answers = shuffle([
        ...question.incorrect_answers.map(decodeHTML),
        correctAnswer
      ]);

      return {
        category: decodeHTML(question.category),
        difficulty: question.difficulty,
        type: question.type,
        question: decodeHTML(question.question),
        correctAnswer,
        answers
      };
    });

    renderQuestion();
    showScreen("game");
  } catch (error) {
    showError(
      error instanceof TypeError
        ? "No pudimos conectar con Open Trivia DB. Comprueba tu conexión e inténtalo de nuevo."
        : error.message
    );
  }
}

$("#setup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  startGame();
});

function renderQuestion() {
  const question = game.questions[game.index];
  game.answered = false;

  const current = game.index + 1;
  const total = game.questions.length;

  $("#progress-text").textContent =
    `${String(current).padStart(2, "0")} / ${total}`;

  $("#score").textContent = game.score;
  $("#correct-count").textContent = game.correct;

  $("#progress-bar").style.width =
    `${(game.index / total) * 100}%`;

  $("#category-label").textContent = question.category;
  $("#difficulty-label").textContent =
    difficultyNames[question.difficulty] || question.difficulty;

  $("#question-category").textContent =
    `PREGUNTA ${current} · ${pointsByDifficulty[question.difficulty]} PUNTOS`;

  $("#question").textContent = question.question;
  $("#answer-hint").textContent =
    "Selecciona una respuesta para continuar.";

  $("#feedback").hidden = true;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";

  $("#next-button").disabled = true;
  $("#next-button").textContent =
    current === total ? "Ver resultado final →" : "Siguiente pregunta →";

  const answersContainer = $("#answers");
  answersContainer.replaceChildren();

  question.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";

    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");
    text.textContent = answer;

    button.append(letter, text);

    button.addEventListener("click", () => {
      checkAnswer(answer, button);
    });

    answersContainer.appendChild(button);
  });
}

function checkAnswer(selectedAnswer, selectedButton) {
  if (game.answered) return;

  game.answered = true;

  const question = game.questions[game.index];
  const isCorrect = selectedAnswer === question.correctAnswer;
  const feedback = $("#feedback");

  document.querySelectorAll(".answer-button").forEach((button) => {
    button.disabled = true;

    const text = button.querySelector("span:last-child").textContent;

    if (text === question.correctAnswer) {
      button.classList.add("correct");
    }
  });

  if (isCorrect) {
    const earned = pointsByDifficulty[question.difficulty];

    game.score += earned;
    game.correct++;
    game.pointsEarned.push(earned);

    feedback.className = "feedback success";
    feedback.textContent = `✓ ¡Correcto! Ganaste ${earned} puntos.`;
  } else {
    game.wrong++;
    game.pointsEarned.push(0);

    selectedButton.classList.add("incorrect");

    feedback.className = "feedback failure";
    feedback.textContent =
      `✗ Incorrecto. La respuesta correcta es: ${question.correctAnswer}`;
  }

  feedback.hidden = false;

  $("#score").textContent = game.score;
  $("#correct-count").textContent = game.correct;

  $("#progress-bar").style.width =
    `${((game.index + 1) / game.questions.length) * 100}%`;

  $("#answer-hint").textContent =
    "Respuesta registrada. ¡Vamos con la siguiente!";

  $("#next-button").disabled = false;
}

$("#next-button").addEventListener("click", () => {
  if (!game.answered) return;

  if (game.index < game.questions.length - 1) {
    game.index++;
    renderQuestion();
  } else {
    showResults();
  }
});

function showResults() {
  const total = game.questions.length;
  const maxScore = game.questions.reduce(
    (sum, question) => sum + pointsByDifficulty[question.difficulty],
    0
  );

  const percentage = total
    ? Math.round((game.correct / total) * 100)
    : 0;

  $("#final-score").textContent = game.score;
  $("#max-score").textContent = `de ${maxScore} puntos`;

  $("#final-correct").textContent = game.correct;
  $("#final-wrong").textContent = game.wrong;
  $("#final-percent").textContent = `${percentage}%`;

  let title;
  let icon;
  let text;

  if (percentage === 100) {
    title = "¡Perfecto!";
    icon = "🏆";
    text = "¡Increíble! Respondiste todas las preguntas correctamente.";
  } else if (percentage >= 70) {
    title = "¡Excelente trabajo!";
    icon = "🚀";
    text = "Tienes muy buenos conocimientos. ¡Sigue así!";
  } else if (percentage >= 40) {
    title = "¡Vas por buen camino!";
    icon = "🧠";
    text = "Has conseguido buenos resultados. Un nuevo intento puede llevarte más lejos.";
  } else {
    title = "¡No te rindas!";
    icon = "💪";
    text = "Cada pregunta es una oportunidad para aprender algo nuevo.";
  }

  $("#result-title").textContent = title;
  $("#result-icon").textContent = icon;
  $("#result-message").textContent = text;

  showScreen("result");
}

function backToSetup() {
  showScreen("setup");
}

$("#retry-button").addEventListener("click", startGame);
$("#config-button").addEventListener("click", backToSetup);
$("#back-button").addEventListener("click", backToSetup);

$("#logo").addEventListener("click", (event) => {
  event.preventDefault();
  backToSetup();
});

updatePointsPreview();
showScreen("setup");