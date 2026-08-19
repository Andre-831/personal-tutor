type MaterialPage = {
  pageNumber: number;
  text: string;
};

type MaterialChunk = {
  pageNumber: number;
  text: string;
};

type MaterialIngestion = {
  status:
    | "ready"
    | "failed";

  text: string;

  pages:
    MaterialPage[];

  chunks:
    MaterialChunk[];

  pageCount: number;
};

type Material = {
  id: string;
  name: string;
  type: string;
  size: number;
  storedPath: string;
  addedAt: string;

  ingestion?:
    MaterialIngestion;
};

type TutorClass = {
  id: string;
  name: string;
  description: string;
  createdAt: string;

  materials:
    Material[];
};

/* =========================
   Sources
========================= */

type TutorSource = {
  materialId: string;
  materialName: string;

  type:
    | "page"
    | "document";

  pageNumber?: number;
  pageCount?: number;
};

/* =========================
   Conversations
========================= */

type ConversationMessage = {
  id: string;

  role:
    | "user"
    | "assistant";

  text: string;

  sources?:
    TutorSource[];

  status?:
    | "generating"
    | "complete"
    | "error";

  error?: string;

  createdAt: string;
};

type Conversation = {
  id: string;

  classId:
    | string
    | null;

  title: string;

  messages:
    ConversationMessage[];

  status:
    | "idle"
    | "generating"
    | "error";

  createdAt: string;
  updatedAt: string;
};

/* =========================
   Flashcards
========================= */

type Flashcard = {
  id: string;
  setId: string;

  front: string;
  back: string;

  position: number;
  createdAt: string;
};

type FlashcardSet = {
  id: string;

  classId:
    | string
    | null;

  title: string;

  cards:
    Flashcard[];

  createdAt: string;
  updatedAt: string;
};

/* =========================
   Quizzes
========================= */

type QuizQuestion = {
  id: string;
  quizId: string;

  question: string;

  type:
    "multiple-choice";

  choices: string[];

  /*
   * Stored as TEXT in SQLite.
   * Convert with Number() when
   * comparing answers.
   */
  correctAnswer: string;

  explanation: string;

  position: number;
};

type Quiz = {
  id: string;

  classId:
    | string
    | null;

  title: string;

  questions:
    QuizQuestion[];

  createdAt: string;
  updatedAt: string;
};

/* =========================
   Quiz Attempts
========================= */

type QuizAttempt = {
  id: string;

  quizId: string;

  /*
   * Percentage score:
   * 0 - 100
   */
  score: number;

  /*
   * questionId -> selected
   * choice index
   */
  answers:
    Record<
      string,
      number
    >;

  startedAt: string;

  completedAt:
    string | null;
};

/* =========================
   Electron API
========================= */

interface Window {
  desktop: {
    platform: string;

    /* -----------------
       Classes
    ----------------- */

    classes: {
      getAll: () =>
        Promise<
          TutorClass[]
        >;

      create: (
        name: string,
        description: string
      ) =>
        Promise<
          TutorClass
        >;

      delete: (
        classId: string
      ) =>
        Promise<boolean>;
    };

    /* -----------------
       Materials
    ----------------- */

    materials: {
      add: (
        classId: string
      ) =>
        Promise<
          Material[]
        >;

      open: (
        materialId: string
      ) =>
        Promise<boolean>;

      delete: (
        classId: string,
        materialId: string
      ) =>
        Promise<boolean>;
    };

    /* -----------------
       Flashcards
    ----------------- */

    flashcards: {
      getAll: (
        classId?:
          string | null
      ) =>
        Promise<
          FlashcardSet[]
        >;

      get: (
        setId: string
      ) =>
        Promise<
          FlashcardSet | null
        >;

      generate: (
        classId: string,
        materialId?:
          string | null,
        count?: number
      ) =>
        Promise<
          FlashcardSet
        >;

      delete: (
        setId: string
      ) =>
        Promise<boolean>;
    };

    /* -----------------
       Quizzes
    ----------------- */

    quizzes: {
      getAll: (
        classId?:
          string | null
      ) =>
        Promise<
          Quiz[]
        >;

      get: (
        quizId: string
      ) =>
        Promise<
          Quiz | null
        >;

      generate: (
        classId: string,
        materialId?:
          string | null,
        count?: number
      ) =>
        Promise<
          Quiz
        >;

      delete: (
        quizId: string
      ) =>
        Promise<boolean>;
    };

    /* -----------------
       Quiz Attempts
    ----------------- */

    quizAttempts: {
      getAll: (
        quizId?: string
      ) =>
        Promise<
          QuizAttempt[]
        >;

      create: (
        attempt: {
          quizId: string;

          score: number;

          answers:
            Record<
              string,
              number
            >;

          startedAt: string;

          completedAt: string;
        }
      ) =>
        Promise<
          QuizAttempt
        >;
    };

    /* -----------------
       Conversations
    ----------------- */

    conversations: {
      getAll: () =>
        Promise<
          Conversation[]
        >;

      get: (
        conversationId:
          string
      ) =>
        Promise<
          Conversation | null
        >;

      getLatest: (
        classId?:
          string | null
      ) =>
        Promise<
          Conversation | null
        >;

      create: (
        classId?:
          string | null
      ) =>
        Promise<
          Conversation
        >;

      send: (
        conversationId:
          string,
        message:
          string
      ) =>
        Promise<
          Conversation
        >;

      onUpdated: (
        callback: (
          conversation:
            Conversation
        ) => void
      ) => () => void;
    };
  };
}