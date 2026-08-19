import {
  useEffect,
  useMemo,
  useState,
} from "react";

function Quizzes() {
  const [
    quizzes,
    setQuizzes,
  ] = useState<Quiz[]>([]);

  const [
    classes,
    setClasses,
  ] = useState<TutorClass[]>([]);

  const [
    activeQuiz,
    setActiveQuiz,
  ] = useState<Quiz | null>(
    null
  );

  const [
    attempts,
    setAttempts,
  ] = useState<
    QuizAttempt[]
  >([]);

  /* =========================
     Generator
  ========================= */

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState("");

  const [
    selectedMaterialId,
    setSelectedMaterialId,
  ] = useState("");

  const [
    questionCount,
    setQuestionCount,
  ] = useState(10);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const selectedClass =
    useMemo(
      () =>
        classes.find(
          (item) =>
            item.id ===
            selectedClassId
        ) || null,
      [
        classes,
        selectedClassId,
      ]
    );

  /* =========================
     Quiz Player State
  ========================= */

  const [
    currentQuestion,
    setCurrentQuestion,
  ] = useState(0);

  const [
    answers,
    setAnswers,
  ] = useState<
    Record<string, number>
  >({});

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    startedAt,
    setStartedAt,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingAttempt,
    setSavingAttempt,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================
     Load Page
  ========================= */

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    setSelectedMaterialId("");
  }, [selectedClassId]);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const [
        quizResult,
        classResult,
      ] = await Promise.all([
        window.desktop.quizzes
          .getAll(),

        window.desktop.classes
          .getAll(),
      ]);

      setQuizzes(
        quizResult
      );

      setClasses(
        classResult
      );

      setSelectedClassId(
        (current) =>
          current ||
          classResult[0]?.id ||
          ""
      );
    } catch (loadError) {
      console.error(
        "Failed to load quizzes:",
        loadError
      );

      setError(
        "Could not load quizzes."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Helpers
  ========================= */

  function getClassName(
    classId:
      string | null
  ) {
    if (!classId) {
      return "General";
    }

    const classData =
      classes.find(
        (item) =>
          item.id === classId
      );

    return (
      classData?.name ||
      "Unknown class"
    );
  }

  /* =========================
     Generate Quiz
  ========================= */

  async function generateQuiz() {
    if (!selectedClassId) {
      setError(
        "Choose a class first."
      );

      return;
    }

    if (
      !selectedClass ||
      selectedClass.materials
        .length === 0
    ) {
      setError(
        "Add material to this class before generating a quiz."
      );

      return;
    }

    try {
      setGenerating(true);
      setError("");

      const newQuiz =
        await window
          .desktop
          .quizzes
          .generate(
            selectedClassId,
            selectedMaterialId ||
              null,
            questionCount
          );

      /*
       * Put the newly generated
       * quiz at the top of the
       * library immediately.
       */
      setQuizzes(
        (current) => [
          newQuiz,
          ...current.filter(
            (quiz) =>
              quiz.id !==
              newQuiz.id
          ),
        ]
      );

      /*
       * Open the new quiz
       * immediately.
       */
      setActiveQuiz(
        newQuiz
      );

      setAttempts([]);

      setCurrentQuestion(
        0
      );

      setAnswers({});

      setSubmitted(
        false
      );

      setStartedAt(
        new Date()
          .toISOString()
      );
    } catch (
      generateError
    ) {
      console.error(
        "Failed to generate quiz:",
        generateError
      );

      const message =
        generateError instanceof
        Error
          ? generateError.message
          : "";

      if (
        message.includes(
          "usage limit"
        ) ||
        message.includes(
          "429"
        )
      ) {
        setError(
          "Gemini's free usage limit has been reached. Try again later."
        );
      } else if (
        message.includes(
          "503"
        ) ||
        message.includes(
          "temporarily busy"
        )
      ) {
        setError(
          "Gemini is temporarily busy. Try again in a moment."
        );
      } else {
        setError(
          "Could not generate quiz."
        );
      }
    } finally {
      setGenerating(
        false
      );
    }
  }

  /* =========================
     Attempts
  ========================= */

  async function loadAttempts(
    quizId: string
  ) {
    try {
      const result =
        await window
          .desktop
          .quizAttempts
          .getAll(
            quizId
          );

      setAttempts(
        result
      );
    } catch (
      attemptError
    ) {
      console.error(
        "Failed to load quiz attempts:",
        attemptError
      );

      setAttempts([]);
    }
  }

  /* =========================
     Open Quiz
  ========================= */

  async function openQuiz(
    quizId: string
  ) {
    try {
      setError("");

      const quiz =
        await window
          .desktop
          .quizzes
          .get(
            quizId
          );

      if (!quiz) {
        setError(
          "Quiz could not be found."
        );

        return;
      }

      setActiveQuiz(
        quiz
      );

      setCurrentQuestion(
        0
      );

      setAnswers({});

      setSubmitted(
        false
      );

      setStartedAt(
        new Date()
          .toISOString()
      );

      await loadAttempts(
        quizId
      );
    } catch (openError) {
      console.error(
        "Failed to open quiz:",
        openError
      );

      setError(
        "Could not open quiz."
      );
    }
  }

  /* =========================
     Delete Quiz
  ========================= */

  async function deleteQuiz(
    quizId: string
  ) {
    try {
      setError("");

      await window
        .desktop
        .quizzes
        .delete(
          quizId
        );

      setQuizzes(
        (current) =>
          current.filter(
            (quiz) =>
              quiz.id !==
              quizId
          )
      );

      if (
        activeQuiz?.id ===
        quizId
      ) {
        setActiveQuiz(
          null
        );

        setAttempts([]);
      }
    } catch (
      deleteError
    ) {
      console.error(
        "Failed to delete quiz:",
        deleteError
      );

      setError(
        "Could not delete quiz."
      );
    }
  }

  /* =========================
     Answers
  ========================= */

  function selectAnswer(
    questionId: string,
    choiceIndex: number
  ) {
    if (submitted) {
      return;
    }

    setAnswers(
      (previous) => ({
        ...previous,

        [questionId]:
          choiceIndex,
      })
    );
  }

  function calculateScore() {
    if (!activeQuiz) {
      return 0;
    }

    return activeQuiz
      .questions
      .reduce(
        (
          total,
          question
        ) => {
          const selected =
            answers[
              question.id
            ];

          const correct =
            Number(
              question
                .correctAnswer
            );

          if (
            selected ===
            correct
          ) {
            return (
              total + 1
            );
          }

          return total;
        },
        0
      );
  }

  function calculatePercentage() {
    if (
      !activeQuiz ||
      activeQuiz.questions
        .length === 0
    ) {
      return 0;
    }

    return Math.round(
      (
        calculateScore() /
        activeQuiz.questions
          .length
      ) * 100
    );
  }

  /* =========================
     Submit
  ========================= */

  async function submitQuiz() {
    if (
      !activeQuiz ||
      savingAttempt
    ) {
      return;
    }

    const unanswered =
      activeQuiz.questions
        .filter(
          (question) =>
            answers[
              question.id
            ] === undefined
        );

    if (
      unanswered.length >
      0
    ) {
      const shouldSubmit =
        window.confirm(
          `You still have ${unanswered.length} unanswered question${
            unanswered.length ===
            1
              ? ""
              : "s"
          }. Submit anyway?`
        );

      if (!shouldSubmit) {
        return;
      }
    }

    try {
      setSavingAttempt(
        true
      );

      setError("");

      const percentage =
        calculatePercentage();

      await window
        .desktop
        .quizAttempts
        .create({
          quizId:
            activeQuiz.id,

          score:
            percentage,

          answers,

          startedAt:
            startedAt ||
            new Date()
              .toISOString(),

          completedAt:
            new Date()
              .toISOString(),
        });

      setSubmitted(
        true
      );

      await loadAttempts(
        activeQuiz.id
      );
    } catch (
      submitError
    ) {
      console.error(
        "Failed to save quiz attempt:",
        submitError
      );

      setError(
        "Your quiz was completed, but the score could not be saved."
      );

      /*
       * Still show the result even
       * if SQLite saving failed.
       */
      setSubmitted(
        true
      );
    } finally {
      setSavingAttempt(
        false
      );
    }
  }

  function retakeQuiz() {
    setAnswers({});

    setCurrentQuestion(
      0
    );

    setSubmitted(
      false
    );

    setStartedAt(
      new Date()
        .toISOString()
    );
  }

  function closeQuiz() {
    setActiveQuiz(
      null
    );

    setAttempts([]);

    setAnswers({});

    setSubmitted(
      false
    );

    setCurrentQuestion(
      0
    );
  }

  /* =========================================================
     Quiz Player
  ========================================================= */

  if (activeQuiz) {
    const question =
      activeQuiz.questions[
        currentQuestion
      ];

    if (!question) {
      return (
        <div className="page quiz-page">
          <button
            className="quiz-back-button"
            onClick={
              closeQuiz
            }
          >
            ← Back to quizzes
          </button>

          <h1>
            {activeQuiz.title}
          </h1>

          <p>
            This quiz has no
            questions.
          </p>
        </div>
      );
    }

    const selectedAnswer =
      answers[
        question.id
      ];

    const correctAnswer =
      Number(
        question.correctAnswer
      );

    const score =
      calculateScore();

    const percentage =
      calculatePercentage();

    const bestScore =
      attempts.length > 0
        ? Math.max(
            ...attempts.map(
              (attempt) =>
                attempt.score
            )
          )
        : null;

    const latestScore =
      attempts[0]
        ?.score ??
      null;

    return (
      <div className="page quiz-page">
        <div className="quiz-header">
          <button
            className="quiz-back-button"
            onClick={
              closeQuiz
            }
          >
            ← Back to quizzes
          </button>

          <div>
            <span className="study-type">
              {getClassName(
                activeQuiz.classId
              )}
            </span>

            <h1>
              {
                activeQuiz.title
              }
            </h1>

            <p>
              {
                activeQuiz
                  .questions
                  .length
              }{" "}
              {
                activeQuiz
                  .questions
                  .length === 1
                  ? "question"
                  : "questions"
              }
            </p>
          </div>
        </div>

        {attempts.length >
          0 &&
          !submitted && (
            <div className="quiz-history-summary">
              <div>
                <span>
                  Attempts
                </span>

                <strong>
                  {
                    attempts.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Latest
                </span>

                <strong>
                  {
                    latestScore
                  }
                  %
                </strong>
              </div>

              <div>
                <span>
                  Best
                </span>

                <strong>
                  {
                    bestScore
                  }
                  %
                </strong>
              </div>
            </div>
          )}

        {submitted && (
          <div className="quiz-result-card">
            <span>
              Quiz complete
            </span>

            <strong>
              {score} /{" "}
              {
                activeQuiz
                  .questions
                  .length
              }
            </strong>

            <h2>
              {percentage}%
            </h2>

            <button
              onClick={
                retakeQuiz
              }
            >
              Retake quiz
            </button>
          </div>
        )}

        {error && (
          <p className="quiz-error">
            {error}
          </p>
        )}

        <div className="quiz-progress">
          Question{" "}
          {currentQuestion +
            1}{" "}
          of{" "}
          {
            activeQuiz
              .questions
              .length
          }
        </div>

        <div className="quiz-question-card">
          <h2>
            {
              question.question
            }
          </h2>

          <div className="quiz-choices">
            {question.choices.map(
              (
                choice,
                index
              ) => {
                let className =
                  "quiz-choice";

                if (
                  selectedAnswer ===
                  index
                ) {
                  className +=
                    " selected";
                }

                if (
                  submitted &&
                  index ===
                    correctAnswer
                ) {
                  className +=
                    " correct";
                }

                if (
                  submitted &&
                  selectedAnswer ===
                    index &&
                  index !==
                    correctAnswer
                ) {
                  className +=
                    " incorrect";
                }

                return (
                  <button
                    key={
                      index
                    }
                    className={
                      className
                    }
                    disabled={
                      submitted
                    }
                    onClick={() =>
                      selectAnswer(
                        question.id,
                        index
                      )
                    }
                  >
                    <span className="quiz-choice-letter">
                      {String.fromCharCode(
                        65 +
                          index
                      )}
                    </span>

                    <span>
                      {choice}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {submitted && (
            <div className="quiz-explanation">
              <strong>
                {selectedAnswer ===
                correctAnswer
                  ? "Correct"
                  : "Correct answer"}
              </strong>

              <p>
                {
                  question.explanation
                }
              </p>
            </div>
          )}
        </div>

        <div className="quiz-navigation">
          <button
            disabled={
              currentQuestion ===
              0
            }
            onClick={() =>
              setCurrentQuestion(
                (
                  previous
                ) =>
                  previous -
                  1
              )
            }
          >
            Previous
          </button>

          {currentQuestion <
          activeQuiz
            .questions
            .length -
            1 ? (
            <button
              onClick={() =>
                setCurrentQuestion(
                  (
                    previous
                  ) =>
                    previous +
                    1
                )
              }
            >
              Next
            </button>
          ) : !submitted ? (
            <button
              className="quiz-submit-button"
              disabled={
                savingAttempt
              }
              onClick={
                submitQuiz
              }
            >
              {savingAttempt
                ? "Submitting..."
                : "Submit quiz"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  /* =========================================================
     Quiz Library
  ========================================================= */

  return (
    <div className="page flashcards-page">
      <div className="flashcards-header">
        <div>
          <h1>
            Quizzes
          </h1>

          <p>
            Generate and take
            quizzes from your class
            materials.
          </p>
        </div>
      </div>

      {error && (
        <div className="flashcards-error">
          {error}
        </div>
      )}

      {/* =========================
          Generator
      ========================= */}

      <section className="flashcard-generator">
        <div className="flashcard-generator-heading">
          <div>
            <h2>
              Generate quiz
            </h2>

            <p>
              Choose what you want
              the tutor to test you
              on.
            </p>
          </div>
        </div>

        <div className="flashcard-generator-controls">
          <label>
            <span>
              Class
            </span>

            <select
              value={
                selectedClassId
              }
              onChange={(
                event
              ) =>
                setSelectedClassId(
                  event.target
                    .value
                )
              }
            >
              {classes.length ===
                0 && (
                <option value="">
                  No classes
                </option>
              )}

              {classes.map(
                (item) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {item.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span>
              Material
            </span>

            <select
              value={
                selectedMaterialId
              }
              onChange={(
                event
              ) =>
                setSelectedMaterialId(
                  event.target
                    .value
                )
              }
              disabled={
                !selectedClass
              }
            >
              <option value="">
                All materials
              </option>

              {selectedClass
                ?.materials
                .map(
                  (
                    material
                  ) => (
                    <option
                      key={
                        material.id
                      }
                      value={
                        material.id
                      }
                    >
                      {
                        material.name
                      }
                    </option>
                  )
                )}
            </select>
          </label>

          <label>
            <span>
              Questions
            </span>

            <select
              value={
                questionCount
              }
              onChange={(
                event
              ) =>
                setQuestionCount(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            >
              <option value={5}>
                5 questions
              </option>

              <option value={10}>
                10 questions
              </option>

              <option value={20}>
                20 questions
              </option>

              <option value={30}>
                30 questions
              </option>
            </select>
          </label>

          <button
            className="generate-flashcards-button"
            onClick={
              generateQuiz
            }
            disabled={
              generating ||
              !selectedClassId
            }
          >
            {generating
              ? "Generating..."
              : "Generate"}
          </button>
        </div>
      </section>

      {/* =========================
          Library
      ========================= */}

      <section className="flashcard-library">
        <div className="flashcard-library-heading">
          <h2>
            Your quizzes
          </h2>

          <span>
            {quizzes.length}{" "}
            {quizzes.length ===
            1
              ? "quiz"
              : "quizzes"}
          </span>
        </div>

        {loading ? (
          <p>
            Loading quizzes...
          </p>
        ) : quizzes.length ===
          0 ? (
          <div className="quiz-empty-state">
            <h2>
              No quizzes yet
            </h2>

            <p>
              Generate a quiz from
              one of your class
              materials to get
              started.
            </p>
          </div>
        ) : (
          <div className="quiz-grid">
            {quizzes.map(
              (quiz) => (
                <div
                  className="quiz-list-card"
                  key={
                    quiz.id
                  }
                >
                  <div>
                    <span className="study-type">
                      {getClassName(
                        quiz.classId
                      )}
                    </span>

                    <h3>
                      {
                        quiz.title
                      }
                    </h3>

                    <p>
                      {quiz
                        .questions
                        ?.length ??
                        0}{" "}
                      {(quiz
                        .questions
                        ?.length ??
                        0) ===
                      1
                        ? "question"
                        : "questions"}
                    </p>
                  </div>

                  <div className="quiz-card-actions">
                    <button
                      onClick={() =>
                        openQuiz(
                          quiz.id
                        )
                      }
                    >
                      Start quiz
                    </button>

                    <button
                      className="quiz-delete-button"
                      onClick={() =>
                        deleteQuiz(
                          quiz.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default Quizzes;