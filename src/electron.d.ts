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

  /*
   * null means a general
   * Home conversation.
   *
   * A string means the chat
   * belongs to a class.
   */
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
      /*
       * No classId:
       * return every flashcard set.
       *
       * classId:
       * return sets belonging
       * to that class.
       */
      getAll: (
        classId?:
          string | null
      ) =>
        Promise<
          FlashcardSet[]
        >;

      /*
       * Load one complete set,
       * including all cards.
       */
      get: (
        setId: string
      ) =>
        Promise<
          FlashcardSet | null
        >;

      /*
       * Generate cards with Gemini
       * from either:
       *
       * - one material
       * - all materials in a class
       */
      generate: (
        classId: string,
        materialId?:
          string | null,
        count?: number
      ) =>
        Promise<
          FlashcardSet
        >;

      /*
       * Delete a set.
       *
       * SQLite cascade deletes
       * the cards belonging to it.
       */
      delete: (
        setId: string
      ) =>
        Promise<boolean>;
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