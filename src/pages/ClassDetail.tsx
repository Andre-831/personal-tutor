import { useState } from "react";

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
          <ClassFlashcards />
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

/* -------------------------------- */
/* Materials                        */
/* -------------------------------- */

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

/* -------------------------------- */
/* Flashcards                       */
/* -------------------------------- */

function ClassFlashcards() {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Flashcards</h2>

          <p>
            Study flashcards generated for
            this class.
          </p>
        </div>

        <button className="primary-button">
          + Generate flashcards
        </button>
      </div>

      <div className="empty-state">
        <p>No flashcards yet.</p>
      </div>
    </>
  );
}

/* -------------------------------- */
/* Quizzes                          */
/* -------------------------------- */

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

/* -------------------------------- */
/* Helpers                          */
/* -------------------------------- */

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