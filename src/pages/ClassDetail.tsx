import { useEffect, useState } from "react";

import ChatInput from "../components/ChatInput";

import type {
  ClassData,
  Material,
} from "../components/ClassCard";

type ClassDetailProps = {
  classData: ClassData;
  onBack: () => void;
  onUpdate: (updatedClass: ClassData) => void;
};

type ClassTab =
  | "overview"
  | "materials"
  | "flashcards"
  | "quizzes";

type Flashcard = {
  id: string;
  setId?: string;
  front: string;
  back: string;
  position: number;
  createdAt: string;
};

type FlashcardSet = {
  id: string;
  classId: string | null;
  title: string;
  cards?: Flashcard[];
  cardCount?: number;
  createdAt: string;
  updatedAt: string;
};


type QuizQuestion = {
  id: string;
  quizId: string;
  question: string;
  type: "multiple-choice";
  choices: string[];
  correctAnswer: string;
  explanation: string;
  position: number;
};

type Quiz = {
  id: string;
  classId: string | null;
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
};

function ClassDetail({
  classData,
  onBack,
  onUpdate,
}: ClassDetailProps) {
  const [activeTab, setActiveTab] =
    useState<ClassTab>("overview");

  const [addingMaterial, setAddingMaterial] =
    useState(false);

  async function addMaterial() {
    try {
      setAddingMaterial(true);

      const newMaterials =
        await window.desktop.materials.add(
          classData.id
        );

      if (newMaterials.length === 0) {
        return;
      }

      onUpdate({
        ...classData,
        materials: [
          ...classData.materials,
          ...newMaterials,
        ],
      });
    } catch (error) {
      console.error(
        "Failed to add material:",
        error
      );
    } finally {
      setAddingMaterial(false);
    }
  }

  async function openMaterial(
    material: Material
  ) {
    try {
      await window.desktop.materials.open(
        material.id
      );
    } catch (error) {
      console.error(
        "Failed to open material:",
        error
      );
    }
  }

  async function deleteMaterial(
    material: Material
  ) {
    try {
      await window.desktop.materials.delete(
        classData.id,
        material.id
      );

      onUpdate({
        ...classData,
        materials:
          classData.materials.filter(
            (item) =>
              item.id !== material.id
          ),
      });
    } catch (error) {
      console.error(
        "Failed to delete material:",
        error
      );
    }
  }

  return (
    <div className="page">
      <button
        className="back-button"
        onClick={onBack}
      >
        ← Classes
      </button>

      <div className="class-header">
        <h1>{classData.name}</h1>
        <p>{classData.description}</p>
      </div>

      <div className="class-tabs">
        <TabButton
          name="Overview"
          value="overview"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />

        <TabButton
          name="Materials"
          value="materials"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />

        <TabButton
          name="Flashcards"
          value="flashcards"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />

        <TabButton
          name="Quizzes"
          value="quizzes"
          activeTab={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      <div className="class-section">
        {activeTab === "overview" && (
          <Overview classData={classData} />
        )}

        {activeTab === "materials" && (
          <Materials
            materials={classData.materials}
            adding={addingMaterial}
            onAdd={addMaterial}
            onOpen={openMaterial}
            onDelete={deleteMaterial}
          />
        )}

        {activeTab === "flashcards" && (
          <ClassFlashcards
            classData={classData}
          />
        )}

        {activeTab === "quizzes" && (
          <ClassQuizzes
            classData={classData}
           />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- */
/* Tabs                             */
/* -------------------------------- */

type TabButtonProps = {
  name: string;
  value: ClassTab;
  activeTab: ClassTab;
  onSelect: (tab: ClassTab) => void;
};

function TabButton({
  name,
  value,
  activeTab,
  onSelect,
}: TabButtonProps) {
  return (
    <button
      className={
        activeTab === value
          ? "active"
          : ""
      }
      onClick={() => onSelect(value)}
    >
      {name}
    </button>
  );
}

/* -------------------------------- */
/* Overview                         */
/* -------------------------------- */

function Overview({
  classData,
}: {
  classData: ClassData;
}) {
  const [flashcardSets, setFlashcardSets] =
    useState<FlashcardSet[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverviewData() {
      try {
        const sets =
          await window.desktop.flashcards.getAll(
            classData.id
          );

        if (!cancelled) {
          setFlashcardSets(sets);
        }
      } catch (error) {
        console.error(
          "Failed to load class overview:",
          error
        );
      }
    }

    loadOverviewData();

    return () => {
      cancelled = true;
    };
  }, [classData.id]);

  const totalCards =
    flashcardSets.reduce(
      (total, set) =>
        total +
        (set.cardCount ??
          set.cards?.length ??
          0),
      0
    );

  return (
    <>
      <div className="overview-section">
        <h2>
          Ask about {classData.name}
        </h2>

        <ChatInput
          classId={classData.id}
          placeholder={`Ask about ${classData.name}...`}
        />
      </div>

      <div className="overview-section">
        <h2>Class overview</h2>

        <div className="study-grid">
          <div className="study-card">
            <span className="study-type">
              Materials
            </span>

            <h3>
              {classData.materials.length}{" "}
              {classData.materials.length === 1
                ? "material"
                : "materials"}
            </h3>

            <p>
              Files available to your tutor.
            </p>
          </div>

          <div className="study-card">
            <span className="study-type">
              Flashcards
            </span>

            <h3>
              {flashcardSets.length === 0
                ? "No flashcards yet"
                : `${flashcardSets.length} ${
                    flashcardSets.length === 1
                      ? "set"
                      : "sets"
                  } · ${totalCards} ${
                    totalCards === 1
                      ? "card"
                      : "cards"
                  }`}
            </h3>

            <p>
              {flashcardSets.length === 0
                ? "Generate flashcards from your class materials."
                : "Flashcards generated for this class."}
            </p>
          </div>

          <div className="study-card">
            <span className="study-type">
              Quiz
            </span>

            <h3>No quizzes yet</h3>

            <p>
              Generate a quiz to practice this class.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}



type MaterialsProps = {
  materials: Material[];
  adding: boolean;
  onAdd: () => void;
  onOpen: (material: Material) => void;
  onDelete: (material: Material) => void;
};

function Materials({
  materials,
  adding,
  onAdd,
  onOpen,
  onDelete,
}: MaterialsProps) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Materials</h2>

          <p>
            Files and resources used by
            your tutor.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={onAdd}
          disabled={adding}
        >
          {adding
            ? "Adding..."
            : "+ Add material"}
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="empty-state">
          <p>No materials yet.</p>

          <button
            className="secondary-button"
            onClick={onAdd}
            disabled={adding}
          >
            {adding
              ? "Adding..."
              : "Add your first material"}
          </button>
        </div>
      ) : (
        <div className="material-list">
          {materials.map((material) => (
            <div
              className="material-row"
              key={material.id}
            >
              <button
                className="material-open-button"
                onClick={() =>
                  onOpen(material)
                }
                title={`Open ${material.name}`}
              >
                <div className="material-icon">
                  {material.type.toUpperCase()}
                </div>

                <div className="material-info">
                  <strong>
                    {material.name}
                  </strong>

                  <span>
                    {formatFileSize(
                      material.size
                    )}
                    {" · "}
                    {formatDate(
                      material.addedAt
                    )}
                  </span>
                </div>
              </button>

              <div className="material-actions">
                <button
                  className="material-action-button"
                  onClick={() =>
                    onOpen(material)
                  }
                >
                  Open
                </button>

                <button
                  className="delete-button"
                  onClick={() =>
                    onDelete(material)
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}



function ClassFlashcards({
  classData,
}: {
  classData: ClassData;
}) {
  const [sets, setSets] =
    useState<FlashcardSet[]>([]);

  const [selectedSet, setSelectedSet] =
    useState<FlashcardSet | null>(null);

  const [cardIndex, setCardIndex] =
    useState(0);

  const [flipped, setFlipped] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadSets() {
    try {
      setLoading(true);

      const result =
        await window.desktop.flashcards.getAll(
          classData.id
        );

      setSets(result);
      setError("");
    } catch (err) {
      console.error(
        "Failed to load flashcards:",
        err
      );

      setError(
        "Could not load flashcards."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSets();
  }, [classData.id]);

  async function generateSet() {
    const readyMaterial =
      classData.materials[0];

    if (!readyMaterial) {
      setError(
        "Add a ready class material first."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");

      const created =
        await window.desktop.flashcards.generate(
          classData.id,
          readyMaterial.id,
          10
        );

      await loadSets();

      setSelectedSet(created);
      setCardIndex(0);
      setFlipped(false);
    } catch (err) {
      console.error(
        "Failed to generate flashcards:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not generate flashcards."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function openSet(
    setId: string
  ) {
    try {
      const fullSet =
        await window.desktop.flashcards.get(
          setId
        );

      if (!fullSet) {
        return;
      }

      setSelectedSet(fullSet);
      setCardIndex(0);
      setFlipped(false);
    } catch (err) {
      console.error(
        "Failed to open flashcards:",
        err
      );
    }
  }

  async function deleteSet(
    setId: string
  ) {
    try {
      await window.desktop.flashcards.delete(
        setId
      );

      if (
        selectedSet?.id === setId
      ) {
        setSelectedSet(null);
      }

      await loadSets();
    } catch (err) {
      console.error(
        "Failed to delete flashcards:",
        err
      );
    }
  }

  if (selectedSet) {
    const cards =
      selectedSet.cards ?? [];

    const currentCard =
      cards[cardIndex];

    if (!currentCard) {
      return (
        <div className="empty-state">
          <p>
            This flashcard set has no cards.
          </p>

          <button
            className="secondary-button"
            onClick={() =>
              setSelectedSet(null)
            }
          >
            Back
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="flashcard-study-header">
          <button
            className="flashcard-back-button"
            onClick={() =>
              setSelectedSet(null)
            }
          >
            ← Flashcards
          </button>

          <div>
            <h1>
              {selectedSet.title}
            </h1>

            <p>
              {cards.length} cards
            </p>
          </div>
        </div>

        <div className="flashcard-progress">
          <span>
            {cardIndex + 1} of{" "}
            {cards.length}
          </span>

          <div className="flashcard-progress-track">
            <div
              className="flashcard-progress-fill"
              style={{
                width: `${
                  ((cardIndex + 1) /
                    cards.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        <div
          className={`flashcard-study-card ${
            flipped
              ? "flipped"
              : ""
          }`}
          onClick={() => {
            const selection =
              window.getSelection();

            if (
              selection &&
              selection
                .toString()
                .trim()
            ) {
              return;
            }

            setFlipped(
              (current) =>
                !current
            );
          }}
        >
          <span className="study-card-label">
            {flipped
              ? "Answer"
              : "Question"}
          </span>

          <span className="study-card-text">
            {flipped
              ? currentCard.back
              : currentCard.front}
          </span>

          <span className="study-card-hint">
            Click to flip
          </span>
        </div>

        <div className="flashcard-navigation">
          <button
            disabled={
              cardIndex === 0
            }
            onClick={() => {
              setCardIndex(
                (index) =>
                  index - 1
              );
              setFlipped(false);
            }}
          >
            ← Previous
          </button>

          <button
            onClick={() =>
              setFlipped(
                (current) =>
                  !current
              )
            }
          >
            Flip
          </button>

          <button
            disabled={
              cardIndex ===
              cards.length - 1
            }
            onClick={() => {
              setCardIndex(
                (index) =>
                  index + 1
              );
              setFlipped(false);
            }}
          >
            Next →
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Flashcards</h2>

          <p>
            Study flashcards generated
            for {classData.name}.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={generateSet}
          disabled={generating}
        >
          {generating
            ? "Generating..."
            : "+ Generate flashcards"}
        </button>
      </div>

      {error && (
        <div className="flashcards-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">
          Loading flashcards...
        </p>
      ) : sets.length === 0 ? (
        <div className="empty-state">
          <p>
            No flashcards yet.
          </p>
        </div>
      ) : (
        <div className="flashcard-set-grid">
                {sets.map((set) => {
                  const cardCount =
                    set.cardCount ??
                    set.cards?.length ??
                    0;

                  return (
                    <div
                      className="flashcard-set-card"
                      key={set.id}
                    >
                      <div className="flashcard-set-content">
                        <div className="flashcard-set-icon">
                          ◫
                        </div>

                        <div className="flashcard-set-title">
                          {set.title}
                        </div>

                        <div className="flashcard-set-meta">
                          {cardCount}{" "}
                          {cardCount === 1
                            ? "card"
                            : "cards"}
                        </div>
                      </div>

                      <div className="flashcard-set-actions">
                        <button
                          className="flashcard-study-button"
                          onClick={() =>
                            openSet(set.id)
                          }
                        >
                          Study
                        </button>

                        <button
                          className="flashcard-delete-button"
                          onClick={() =>
                            deleteSet(set.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
      </div>
      )}
    </>
  );
}



function ClassQuizzes({
  classData,
}: {
  classData: ClassData;
}) {
  const [quizzes, setQuizzes] =
    useState<Quiz[]>([]);

  const [selectedQuiz, setSelectedQuiz] =
    useState<Quiz | null>(null);

  const [questionIndex, setQuestionIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<Record<string, number>>({});

  const [submitted, setSubmitted] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadQuizzes() {
    try {
      setLoading(true);

      const result =
        await window.desktop.quizzes.getAll(
          classData.id
        );

      setQuizzes(result);
      setError("");
    } catch (err) {
      console.error(
        "Failed to load quizzes:",
        err
      );

      setError(
        "Could not load quizzes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
  }, [classData.id]);

  async function generateQuiz() {
    const readyMaterial =
      classData.materials[0];

    if (!readyMaterial) {
      setError(
        "Add a ready class material first."
      );
      return;
    }

    try {
      setGenerating(true);
      setError("");

      const created =
        await window.desktop.quizzes.generate(
          classData.id,
          readyMaterial.id,
          10
        );

      await loadQuizzes();

      // Open the newly generated quiz immediately.
      setSelectedQuiz(created);
      setQuestionIndex(0);
      setAnswers({});
      setSubmitted(false);
    } catch (err) {
      console.error(
        "Failed to generate quiz:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not generate quiz."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function openQuiz(
    quizId: string
  ) {
    try {
      setError("");

      const fullQuiz =
        await window.desktop.quizzes.get(
          quizId
        );

      if (!fullQuiz) {
        setError(
          "Could not find this quiz."
        );
        return;
      }

      setSelectedQuiz(fullQuiz);
      setQuestionIndex(0);
      setAnswers({});
      setSubmitted(false);
    } catch (err) {
      console.error(
        "Failed to open quiz:",
        err
      );

      setError(
        "Could not open quiz."
      );
    }
  }

  async function deleteQuiz(
    quizId: string
  ) {
    try {
      await window.desktop.quizzes.delete(
        quizId
      );

      if (selectedQuiz?.id === quizId) {
        setSelectedQuiz(null);
      }

      await loadQuizzes();
    } catch (err) {
      console.error(
        "Failed to delete quiz:",
        err
      );

      setError(
        "Could not delete quiz."
      );
    }
  }

  function selectAnswer(
    questionId: string,
    choiceIndex: number
  ) {
    if (submitted) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [questionId]: choiceIndex,
    }));
  }

  function retakeQuiz() {
    setAnswers({});
    setQuestionIndex(0);
    setSubmitted(false);
  }

//quiz player

  if (selectedQuiz) {
    const questions =
      selectedQuiz.questions ?? [];

    const currentQuestion =
      questions[questionIndex];

    if (!currentQuestion) {
      return (
        <div className="empty-state">
          <p>
            This quiz has no questions.
          </p>

          <button
            className="secondary-button"
            onClick={() =>
              setSelectedQuiz(null)
            }
          >
            ← Back to quizzes
          </button>
        </div>
      );
    }

    const selectedAnswer =
      answers[currentQuestion.id];

    const correctAnswer =
      Number(
        currentQuestion.correctAnswer
      );

    const score =
      questions.reduce(
        (total, question) => {
          const answer =
            answers[question.id];

          const correct =
            Number(
              question.correctAnswer
            );

          return answer === correct
            ? total + 1
            : total;
        },
        0
      );

    const percentage =
      questions.length > 0
        ? Math.round(
            (score /
              questions.length) *
              100
          )
        : 0;

    return (
      <>
        <div className="flashcard-study-header">
          <button
            className="flashcard-back-button"
            onClick={() =>
              setSelectedQuiz(null)
            }
          >
            ← Quizzes
          </button>

          <div>
            <h1>
              {selectedQuiz.title}
            </h1>

            <p>
              {questions.length} questions
            </p>
          </div>
        </div>

        <div className="flashcard-progress">
          <span>
            {questionIndex + 1} of{" "}
            {questions.length}
          </span>

          <div className="flashcard-progress-track">
            <div
              className="flashcard-progress-fill"
              style={{
                width: `${
                  ((questionIndex + 1) /
                    questions.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {submitted && (
          <div className="quiz-result-card">
            <span>Your score</span>

            <h2>
              {score} /{" "}
              {questions.length}
            </h2>

            <strong>
              {percentage}%
            </strong>

            <button
              className="secondary-button"
              onClick={retakeQuiz}
            >
              Retake quiz
            </button>
          </div>
        )}

        <div className="quiz-question-card">
          <span className="study-card-label">
            Question{" "}
            {questionIndex + 1}
          </span>

          <h2>
            {currentQuestion.question}
          </h2>

          <div className="quiz-choices">
            {currentQuestion.choices.map(
              (choice, index) => {
                let className =
                  "quiz-choice";

                if (
                  selectedAnswer === index
                ) {
                  className +=
                    " selected";
                }

                if (
                  submitted &&
                  index === correctAnswer
                ) {
                  className +=
                    " correct";
                }

                if (
                  submitted &&
                  selectedAnswer ===
                    index &&
                  index !== correctAnswer
                ) {
                  className +=
                    " incorrect";
                }

                return (
                  <button
                    key={index}
                    className={
                      className
                    }
                    disabled={
                      submitted
                    }
                    onClick={() =>
                      selectAnswer(
                        currentQuestion.id,
                        index
                      )
                    }
                  >
                    <span className="quiz-choice-letter">
                      {String.fromCharCode(
                        65 + index
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
                  currentQuestion.explanation
                }
              </p>
            </div>
          )}
        </div>

        <div className="flashcard-navigation">
          <button
            disabled={
              questionIndex === 0
            }
            onClick={() =>
              setQuestionIndex(
                (index) => index - 1
              )
            }
          >
            ← Previous
          </button>

          {!submitted &&
          questionIndex ===
            questions.length - 1 ? (
            <button
              className="primary-button"
              onClick={() =>
                setSubmitted(true)
              }
            >
              Submit quiz
            </button>
          ) : (
            <button
              disabled={
                questionIndex ===
                questions.length - 1
              }
              onClick={() =>
                setQuestionIndex(
                  (index) => index + 1
                )
              }
            >
              Next →
            </button>
          )}
        </div>
      </>
    );
  }

//quiz list

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Quizzes</h2>

          <p>
            Practice quizzes generated
            for {classData.name}.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={generateQuiz}
          disabled={generating}
        >
          {generating
            ? "Generating..."
            : "+ Generate quiz"}
        </button>
      </div>

      {error && (
        <div className="flashcards-error">
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">
          Loading quizzes...
        </p>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <p>
            No quizzes yet.
          </p>
        </div>
      ) : (
<div className="quiz-grid">
  {quizzes.map((quiz) => {
    const questionCount =
      quiz.questions?.length ??
      0;

    return (
      <div
        className="quiz-list-card"
        key={quiz.id}
      >
        <div>
          <span className="study-type">
            {classData.name}
          </span>

          <h3>
            {quiz.title}
          </h3>

          <p>
            {questionCount}{" "}
            {questionCount === 1
              ? "question"
              : "questions"}
          </p>
        </div>

        <div className="quiz-card-actions">
          <button
            onClick={() =>
              openQuiz(quiz.id)
            }
          >
            Start quiz
          </button>

          <button
            className="quiz-delete-button"
            onClick={() =>
              deleteQuiz(quiz.id)
            }
          >
            Delete
          </button>
        </div>
      </div>
    );
  })}
        </div>
      )}
    </>
  );
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDate(
  date: string
) {
  return new Date(
    date
  ).toLocaleDateString();
}

export default ClassDetail;