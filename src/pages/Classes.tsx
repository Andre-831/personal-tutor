import {
  useEffect,
  useState,
} from "react";

import ClassCard, {
  type ClassData,
} from "../components/ClassCard";

import AddClassModal from "../components/AddClassModal";
import ClassDetail from "./ClassDetail";

function Classes() {
  const [classes, setClasses] =
    useState<ClassData[]>([]);

  const [showModal, setShowModal] =
    useState(false);

  const [selectedClass, setSelectedClass] =
    useState<ClassData | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    try {
      const savedClasses =
        await window.desktop.classes.getAll();

      setClasses(savedClasses);
    } catch (error) {
      console.error(
        "Failed to load classes:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function createClass(
    name: string,
    description: string
  ) {
    try {
      const newClass =
        await window.desktop.classes.create(
          name,
          description
        );

      setClasses((current) => [
        ...current,
        newClass,
      ]);

      setShowModal(false);
    } catch (error) {
      console.error(
        "Failed to create class:",
        error
      );
    }
  }

  function updateClass(
    updatedClass: ClassData
  ) {
    setSelectedClass(updatedClass);

    setClasses((current) =>
      current.map((item) =>
        item.id === updatedClass.id
          ? updatedClass
          : item
      )
    );
  }

  if (selectedClass) {
    return (
      <ClassDetail
        classData={selectedClass}
        onBack={() =>
          setSelectedClass(null)
        }
        onUpdate={updateClass}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Classes</h1>
          <p>
            Organize your courses and study
            materials.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() =>
            setShowModal(true)
          }
        >
          + Add class
        </button>
      </div>

      {loading ? (
        <p className="muted">
          Loading classes...
        </p>
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <p>You don't have any classes yet.</p>

          <button
            className="primary-button"
            onClick={() =>
              setShowModal(true)
            }
          >
            + Create your first class
          </button>
        </div>
      ) : (
        <div className="class-grid">
          {classes.map((classData) => (
            <ClassCard
              key={classData.id}
              classData={classData}
              onClick={() =>
                setSelectedClass(
                  classData
                )
              }
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddClassModal
          onClose={() =>
            setShowModal(false)
          }
          onCreate={createClass}
        />
      )}
    </div>
  );
}

export default Classes;