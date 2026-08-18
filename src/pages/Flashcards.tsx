import {
  useEffect,
  useMemo,
  useState,
} from "react";

function Flashcards() {
  const [
    classes,
    setClasses,
  ] = useState<TutorClass[]>([]);

  const [
    sets,
    setSets,
  ] = useState<FlashcardSet[]>([]);

  const [
    selectedSet,
    setSelectedSet,
  ] = useState<FlashcardSet | null>(
    null
  );

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState("");

  const [
    selectedMaterialId,
    setSelectedMaterialId,
  ] = useState("");

  const [
    cardCount,
    setCardCount,
  ] = useState(10);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    cardIndex,
    setCardIndex,
  ] = useState(0);

  const [
    flipped,
    setFlipped,
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

  async function loadData() {
    try {
      setError("");

      const [
        loadedClasses,
        loadedSets,
      ] =
        await Promise.all([
          window.desktop.classes.getAll(),
          window.desktop.flashcards.getAll(),
        ]);

      setClasses(
        loadedClasses
      );

      setSets(
        loadedSets
      );

      /*
       * Automatically select the
       * first class so generating
       * is fast.
       */
      setSelectedClassId(
        (current) =>
          current ||
          loadedClasses[0]?.id ||
          ""
      );
    } catch (loadError) {
      console.error(
        "Failed to load flashcards:",
        loadError
      );

      setError(
        "Could not load flashcards."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
   * When changing classes, reset
   * the selected material.
   */
  useEffect(() => {
    setSelectedMaterialId("");
  }, [selectedClassId]);

  async function generate() {
    if (!selectedClassId) {
      setError(
        "Choose a class first."
      );

      return;
    }

    if (
      !selectedClass ||
      selectedClass.materials.length ===
        0
    ) {
      setError(
        "Add material to this class before generating flashcards."
      );

      return;
    }

    try {
      setGenerating(true);
      setError("");

      const newSet =
        await window.desktop.flashcards.generate(
          selectedClassId,
          selectedMaterialId ||
            null,
          cardCount
        );

      setSets(
        (current) => [
          newSet,
          ...current,
        ]
      );

      setSelectedSet(
        newSet
      );

      setCardIndex(0);
      setFlipped(false);
    } catch (generateError) {
      console.error(
        "Failed to generate flashcards:",
        generateError
      );

      const message =
        generateError instanceof Error
          ? generateError.message
          : "";

      if (
        message.includes(
          "503"
        )
      ) {
        setError(
          "Gemini is temporarily busy. Try again in a moment."
        );
      } else {
        setError(
          "Could not generate flashcards."
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  async function openSet(
    setId: string
  ) {
    try {
      setError("");

      const fullSet =
        await window.desktop.flashcards.get(
          setId
        );

      if (!fullSet) {
        setError(
          "Flashcard set not found."
        );

        return;
      }

      setSelectedSet(
        fullSet
      );

      setCardIndex(0);
      setFlipped(false);
    } catch (openError) {
      console.error(
        "Failed to open flashcards:",
        openError
      );

      setError(
        "Could not open this flashcard set."
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

      setSets(
        (current) =>
          current.filter(
            (set) =>
              set.id !==
              setId
          )
      );

      if (
        selectedSet?.id ===
        setId
      ) {
        setSelectedSet(
          null
        );

        setCardIndex(0);
        setFlipped(false);
      }
    } catch (deleteError) {
      console.error(
        "Failed to delete flashcards:",
        deleteError
      );

      setError(
        "Could not delete this flashcard set."
      );
    }
  }

  function nextCard() {
    if (!selectedSet) {
      return;
    }

    if (
      cardIndex >=
      selectedSet.cards.length - 1
    ) {
      return;
    }

    setCardIndex(
      (current) =>
        current + 1
    );

    setFlipped(false);
  }

  function previousCard() {
    if (cardIndex <= 0) {
      return;
    }

    setCardIndex(
      (current) =>
        current - 1
    );

    setFlipped(false);
  }

  if (loading) {
    return (
      <div className="page">
        <h1>Flashcards</h1>

        <p>
          Loading flashcards...
        </p>
      </div>
    );
  }

  /*
   * Study mode.
   */
  if (selectedSet) {
    const currentCard =
      selectedSet.cards[
        cardIndex
      ];

    return (
      <div className="page flashcards-page">
        <div className="flashcard-study-header">
          <button
            className="flashcard-back-button"
            onClick={() => {
              setSelectedSet(
                null
              );

              setCardIndex(0);
              setFlipped(false);
            }}
          >
            ← Back
          </button>

          <div>
            <h1>
              {selectedSet.title}
            </h1>

            <p>
              {selectedSet.cards.length}{" "}
              cards
            </p>
          </div>
        </div>

        {currentCard ? (
          <>
            <div className="flashcard-progress">
              <span>
                {cardIndex + 1} /{" "}
                {selectedSet.cards.length}
              </span>

              <div className="flashcard-progress-track">
                <div
                  className="flashcard-progress-fill"
                  style={{
                    width: `${
                      ((cardIndex +
                        1) /
                        selectedSet
                          .cards
                          .length) *
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

                /*
                * If the user highlighted text,
                * don't flip the card.
                */
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
                onClick={
                  previousCard
                }
                disabled={
                  cardIndex === 0
                }
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
                onClick={
                  nextCard
                }
                disabled={
                  cardIndex ===
                  selectedSet.cards
                    .length -
                    1
                }
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <p>
            This flashcard set is
            empty.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="page flashcards-page">
      <div className="flashcards-header">
        <div>
          <h1>Flashcards</h1>

          <p>
            Generate and study
            flashcards from your
            class materials.
          </p>
        </div>
      </div>

      {error && (
        <div className="flashcards-error">
          {error}
        </div>
      )}

      <section className="flashcard-generator">
        <div className="flashcard-generator-heading">
          <div>
            <h2>
              Generate flashcards
            </h2>

            <p>
              Choose what you want
              the tutor to study.
            </p>
          </div>
        </div>

        <div className="flashcard-generator-controls">
          <label>
            <span>Class</span>

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

              {selectedClass?.materials.map(
                (material) => (
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
            <span>Cards</span>

            <select
              value={
                cardCount
              }
              onChange={(
                event
              ) =>
                setCardCount(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            >
              <option value={10}>
                10 cards
              </option>

              <option value={20}>
                20 cards
              </option>

              <option value={30}>
                30 cards
              </option>
            </select>
          </label>

          <button
            className="generate-flashcards-button"
            onClick={
              generate
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

      <section className="flashcard-library">
        <div className="flashcard-library-heading">
          <h2>
            Your flashcards
          </h2>

          <span>
            {sets.length}{" "}
            {sets.length === 1
              ? "set"
              : "sets"}
          </span>
        </div>

        {sets.length === 0 ? (
          <div className="flashcard-empty">
            <h3>
              No flashcards yet
            </h3>

            <p>
              Generate a set from
              one of your class
              materials to get
              started.
            </p>
          </div>
        ) : (
          <div className="flashcard-set-grid">
            {sets.map(
              (set) => {
                const ownerClass =
                  classes.find(
                    (item) =>
                      item.id ===
                      set.classId
                  );

                return (
                  <div
                    className="flashcard-set-card"
                    key={
                      set.id
                    }
                  >
                    <button
                      className="flashcard-set-open"
                      onClick={() =>
                        openSet(
                          set.id
                        )
                      }
                    >
                      <span className="flashcard-set-icon">
                        ◫
                      </span>

                      <span className="flashcard-set-title">
                        {
                          set.title
                        }
                      </span>

                      <span className="flashcard-set-meta">
                        {ownerClass?.name ||
                          "General"}{" "}
                        ·{" "}
                        {
                          set.cards
                            .length
                        }{" "}
                        cards
                      </span>
                    </button>

                    <button
                      className="flashcard-set-delete"
                      onClick={() =>
                        deleteSet(
                          set.id
                        )
                      }
                      title="Delete flashcard set"
                    >
                      ×
                    </button>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default Flashcards;