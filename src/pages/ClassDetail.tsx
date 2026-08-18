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
          <ClassQuizzes />
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

            <h3>No flashcards yet</h3>

            <p>
              Generate flashcards from your
              class materials.
            </p>
          </div>

          <div className="study-card">
            <span className="study-type">
              Quiz
            </span>

            <h3>No quizzes yet</h3>

            <p>
              Generate a quiz to practice
              this class.
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
          {sets.map((set) => (
            <div
              className="flashcard-set-card"
              key={set.id}
            >
              <button
                className="flashcard-set-open"
                onClick={() =>
                  openSet(set.id)
                }
              >
                <div className="flashcard-set-icon">
                  ◫
                </div>

                <div className="flashcard-set-title">
                  {set.title}
                </div>

                <div className="flashcard-set-meta">
                  {set.cardCount ??
                    set.cards?.length ??
                    0}{" "}
                  cards
                </div>
              </button>

              <button
                className="flashcard-set-delete"
                onClick={() =>
                  deleteSet(set.id)
                }
                title="Delete flashcard set"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}



function ClassQuizzes() {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Quizzes</h2>

          <p>
            Practice quizzes generated for
            this class.
          </p>
        </div>

        <button className="primary-button">
          + Generate quiz
        </button>
      </div>

      <div className="empty-state">
        <p>No quizzes yet.</p>
      </div>
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