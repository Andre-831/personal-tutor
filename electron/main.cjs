require("dotenv").config();

const {app,BrowserWindow,ipcMain,dialog,shell,} = require("electron");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {ingestMaterial,} = require("./services/ingestion.cjs");

const { streamTutorResponse,generateFlashcards, generateQuiz} = require("./services/ai.cjs");



const {
  initializeDatabase,
  migrateFromJson,

  getClassesWithMaterials,
  getClassWithMaterials,
  createClass: dbCreateClass,
  deleteClass: dbDeleteClass,

  getMaterial,
  createMaterial: dbCreateMaterial,
  deleteMaterial: dbDeleteMaterial,

  getConversation: dbGetConversation,
  getAllConversations: dbGetAllConversations,
  saveConversation: dbSaveConversation,

  getFlashcardSets: dbGetFlashcardSets,
  getFlashcardSet: dbGetFlashcardSet,
  createFlashcardSet: dbCreateFlashcardSet,
  deleteFlashcardSet: dbDeleteFlashcardSet,
  
  getQuizzes: dbGetQuizzes,
  getQuiz: dbGetQuiz,
  createQuiz: dbCreateQuiz,
  deleteQuiz: dbDeleteQuiz,

  getQuizAttempts: dbGetQuizAttempts,

  createQuizAttempt: dbCreateQuizAttempt,

} = require("./services/database.cjs");

const isDev = !app.isPackaged;


/* =========================================================
   Storage
========================================================= */

function getDataFile() {
  return path.join(
    app.getPath("userData"),
    "data.json"
  );
}

function getMaterialsDirectory() {
  return path.join(
    app.getPath("userData"),
    "materials"
  );
}

function ensureStorage() {
  const materialsDirectory =
    getMaterialsDirectory();

  if (!fs.existsSync(materialsDirectory)) {
    fs.mkdirSync(
      materialsDirectory,
      {
        recursive: true,
      }
    );
  }

  // Open tutor.db and create tables.
  initializeDatabase(
    app.getPath("userData")
  );

  // Import our old data.json once.
  const migration =
    migrateFromJson(
      getDataFile()
    );

  if (migration.migrated) {
    console.log(
      "Existing tutor data migrated to SQLite:",
      migration
    );
  }
}

//convos

/*
 * Active generations live here instead
 * of inside React.
 *
 * Therefore changing pages does NOT
 * stop Gemini.
 */
const activeGenerations =
  new Map();

function getConversation(
  conversationId
) {
  const active =
    activeGenerations.get(
      conversationId
    );

  if (active) {
    return active.conversation;
  }

  return dbGetConversation(
    conversationId
  );
}

function saveConversation(
  conversation
) {
  return dbSaveConversation(
    conversation
  );
}

function broadcastConversation(
  conversation
) {
  for (
    const window of
    BrowserWindow.getAllWindows()
  ) {
    if (
      window.isDestroyed()
    ) {
      continue;
    }

    window.webContents.send(
      "conversation:updated",
      conversation
    );
  }
}

function makeConversationTitle(
  message
) {
  const clean =
    message
      .replace(/\s+/g, " ")
      .trim();

  if (
    clean.length <= 45
  ) {
    return clean;
  }

  return `${clean.slice(
    0,
    45
  )}...`;
}

function createConversation({
  classId = null,
  title = "New conversation",
} = {}) {
  const now =
    new Date().toISOString();

  const conversation = {
    id: crypto.randomUUID(),

    classId,

    title,

    messages: [],

    status: "idle",

    createdAt: now,
    updatedAt: now,
  };

  saveConversation(
    conversation
  );

  return conversation;
}

function getAllConversations() {
  const conversations =
    dbGetAllConversations();

  /*
   * Replace persisted versions with
   * their live generating versions.
   */
  for (
    const {
      conversation,
    } of activeGenerations.values()
  ) {
    const index =
      conversations.findIndex(
        (item) =>
          item.id ===
          conversation.id
      );

    if (index >= 0) {
      conversations[index] =
        conversation;
    } else {
      conversations.push(
        conversation
      );
    }
  }

  return conversations.sort(
    (a, b) =>
      new Date(
        b.updatedAt
      ).getTime() -
      new Date(
        a.updatedAt
      ).getTime()
  );
}

function getConversationsForContext(
  classId
) {
  return getAllConversations()
    .filter(
      (conversation) =>
        conversation.classId ===
        classId
    );
}



async function runConversationGeneration(
  conversationId
) {
  const active =
    activeGenerations.get(
      conversationId
    );

  if (!active) {
    return;
  }

  const assistantMessageId =
    active.assistantMessageId;

  let conversation =
    active.conversation;

  /*
   * Find the latest user prompt.
   */
  const latestUserMessage =
    [...conversation.messages]
      .reverse()
      .find(
        (message) =>
          message.role ===
          "user"
      );

  if (!latestUserMessage) {
    activeGenerations.delete(
      conversationId
    );

    return;
  }

  /*
   * Load class material if this
   * conversation belongs to a class.
   */
  let classData = null;

  if (
    conversation.classId
  ) {
    classData =
      getClassWithMaterials(
        conversation.classId
      );
  }

  /*
   * Give Gemini the conversation before
   * the current user message.
   *
   * We exclude:
   * - current user message
   * - empty assistant placeholder
   */
  const currentUserIndex =
    conversation.messages.findIndex(
      (message) =>
        message.id ===
        latestUserMessage.id
    );

  const history =
    conversation.messages
      .slice(
        0,
        currentUserIndex
      )
      .filter(
        (message) =>
          message.text
      )
      .map(
        (message) => ({
          role:
            message.role,

          text:
            message.text,
        })
      );

  try {
    const response =
      await streamTutorResponse({
        message:
          latestUserMessage.text,

        classData,

        history,

        onChunk: (text) => {
          const runtime =
            activeGenerations.get(
              conversationId
            );

          if (!runtime) {
            return;
          }

          runtime.conversation = {
            ...runtime.conversation,

            messages:
              runtime.conversation
                .messages
                .map(
                  (message) =>
                    message.id ===
                    assistantMessageId
                      ? {
                          ...message,

                          text:
                            message.text +
                            text,
                        }
                      : message
                ),

            updatedAt:
              new Date()
                .toISOString(),
          };

          /*
           * Don't write data.json on
           * every chunk. Keep streaming
           * state in memory and broadcast
           * it to React.
           */
          broadcastConversation(
            runtime.conversation
          );
        },
      });

    const runtime =
      activeGenerations.get(
        conversationId
      );

    if (!runtime) {
      return;
    }

    const finished = {
      ...runtime.conversation,

      messages:
        runtime.conversation
          .messages
          .map(
            (message) =>
              message.id ===
              assistantMessageId
                ? {
                    ...message,

                    text:
                      message.text ||
                      response.text,

                    sources:
                      response.sources,

                    status:
                      "complete",

                    error:
                      undefined,
                  }
                : message
          ),

      status: "idle",

      updatedAt:
        new Date()
          .toISOString(),
    };

    activeGenerations.delete(
      conversationId
    );

    saveConversation(
      finished
    );

    broadcastConversation(
      finished
    );
  } catch (error) {
    console.error(
      "Conversation generation failed:",
      error
    );

    const runtime =
      activeGenerations.get(
        conversationId
      );

    if (!runtime) {
      return;
    }

    const errorMessage =
      error?.status === 503
        ? "Gemini is temporarily busy. Try again in a moment."
        : "The tutor request failed.";

    const failed = {
      ...runtime.conversation,

      messages:
        runtime.conversation
          .messages
          .map(
            (message) =>
              message.id ===
              assistantMessageId
                ? {
                    ...message,

                    status:
                      "error",

                    error:
                      errorMessage,
                  }
                : message
          ),

      status: "error",

      updatedAt:
        new Date()
          .toISOString(),
    };

    activeGenerations.delete(
      conversationId
    );

    saveConversation(
      failed
    );

    broadcastConversation(
      failed
    );
  }
}

function createWindow() {
  const window =
    new BrowserWindow({
      width: 1400,
      height: 900,

      minWidth: 900,
      minHeight: 600,

      backgroundColor:
        "#171717",

      titleBarStyle:
        "hiddenInset",

      trafficLightPosition: {
        x: 18,
        y: 18,
      },

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs"
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false,
      },
    });

  if (isDev) {
    window.loadURL(
      "http://localhost:5173"
    );
  } else {
    window.loadFile(
      path.join(
        __dirname,
        "../dist/index.html"
      )
    );
  }
}



ipcMain.handle(
  "conversations:get-all",
  () => {
    return getAllConversations();
  }
);

ipcMain.handle(
  "conversations:get",
  (
    _event,
    conversationId
  ) => {
    return getConversation(
      conversationId
    );
  }
);

ipcMain.handle(
  "conversations:get-latest",
  (
    _event,
    classId = null
  ) => {
    const conversations =
      getConversationsForContext(
        classId
      );

    return (
      conversations[0] ||
      null
    );
  }
);

ipcMain.handle(
  "conversations:create",
  (
    _event,
    payload = {}
  ) => {
    return createConversation(
      payload
    );
  }
);

ipcMain.handle(
  "conversations:send",
  (
    _event,
    payload
  ) => {
    const {
      conversationId,
      message,
    } = payload;

    const text =
      message?.trim();

    if (!text) {
      throw new Error(
        "Message is required"
      );
    }

    let conversation =
      getConversation(
        conversationId
      );

    if (!conversation) {
      throw new Error(
        "Conversation not found"
      );
    }

    /*
     * One generation at a time inside
     * each conversation.
     */
    if (
      activeGenerations.has(
        conversationId
      )
    ) {
      throw new Error(
        "This conversation is already generating."
      );
    }

    const now =
      new Date()
        .toISOString();

    /*
     * First prompt becomes title.
     */
    if (
      conversation.messages
        .length === 0
    ) {
      conversation = {
        ...conversation,

        title:
          makeConversationTitle(
            text
          ),
      };
    }

    const userMessage = {
      id:
        crypto.randomUUID(),

      role: "user",

      text,

      createdAt: now,
    };

    const assistantMessage = {
      id:
        crypto.randomUUID(),

      role: "assistant",

      text: "",

      sources: [],

      status:
        "generating",

      createdAt: now,
    };

    conversation = {
      ...conversation,

      messages: [
        ...conversation.messages,
        userMessage,
        assistantMessage,
      ],

      status:
        "generating",

      updatedAt:
        now,
    };

    activeGenerations.set(
      conversationId,
      {
        conversation,

        assistantMessageId:
          assistantMessage.id,
      }
    );

    /*
     * Save immediately so the user
     * message is persistent.
     */
    saveConversation(
      conversation
    );

    broadcastConversation(
      conversation
    );

    /*
     * Intentionally NOT awaited.
     *
     * Electron owns the generation.
     */
    runConversationGeneration(
      conversationId
    );

    return conversation;
  }
);



/* =========================================================
   Classes
========================================================= */

ipcMain.handle(
  "classes:get",
  () => {
    return getClassesWithMaterials();
  }
);

ipcMain.handle(
  "classes:create",
  (
    _event,
    {
      name,
      description,
    }
  ) => {
    const newClass = {
      id: crypto.randomUUID(),

      name,

      description,

      createdAt:
        new Date().toISOString(),
    };

    return dbCreateClass(
      newClass
    );
  }
);

ipcMain.handle(
  "classes:delete",
  (
    _event,
    classId
  ) => {
    const classToDelete =
      getClassWithMaterials(
        classId
      );

    if (classToDelete) {
      for (
        const material of
        classToDelete.materials || []
      ) {
        if (
          material.storedPath &&
          fs.existsSync(
            material.storedPath
          )
        ) {
          fs.unlinkSync(
            material.storedPath
          );
        }
      }
    }

    dbDeleteClass(
      classId
    );

    return true;
  }
);


ipcMain.handle(
  "materials:add",
  async (
    _event,
    classId
  ) => {
    const result =
      await dialog.showOpenDialog({
        title:
          "Add study material",

        properties: [
          "openFile",
          "multiSelections",
        ],

        filters: [
          {
            name:
              "Study Materials",

            extensions: [
              "pdf",
              "txt",
              "md",
            ],
          },
        ],
      });

    if (
      result.canceled
    ) {
      return [];
    }

  const classData =
    getClassWithMaterials(
      classId
    );

    if (!classData) {
      throw new Error(
        "Class not found"
      );
    }

    const importedMaterials =
      [];

    for (
      const sourcePath of
      result.filePaths
    ) {
      const id =
        crypto.randomUUID();

      const extension =
        path.extname(
          sourcePath
        );

      const type =
        extension
          .replace(".", "")
          .toLowerCase();

      const storedFilename =
        `${id}${extension}`;

      const storedPath =
        path.join(
          getMaterialsDirectory(),
          storedFilename
        );

      fs.copyFileSync(
        sourcePath,
        storedPath
      );

      const stats =
        fs.statSync(
          storedPath
        );

      let ingestion;

      try {
        const extracted =
          await ingestMaterial(
            storedPath,
            type
          );

        ingestion = {
          status:
            "ready",

          text:
            extracted.text,

          pages:
            extracted.pages,

          chunks:
            extracted.chunks,

          pageCount:
            extracted.pageCount,
        };

        console.log(
          `Ingested ${path.basename(
            sourcePath
          )}:`,
          `${extracted.pageCount} pages,`,
          `${extracted.chunks.length} chunks`
        );
      } catch (error) {
        console.error(
          `Failed to ingest ${sourcePath}:`,
          error
        );

        ingestion = {
          status:
            "failed",

          text: "",

          pages: [],

          chunks: [],

          pageCount: 0,
        };
      }

      const material = {
        id,

        name:
          path.basename(
            sourcePath
          ),

        type,

        size:
          stats.size,

        storedPath,

        addedAt:
          new Date()
            .toISOString(),

        ingestion,
      };

const savedMaterial =
  dbCreateMaterial({
    classId,
    material,
  });

importedMaterials.push(
  savedMaterial
);
}

return importedMaterials;
  }
);


ipcMain.handle(
  "materials:delete",
  (
    _event,
    {
      classId,
      materialId,
    }
  ) => {
    const classData =
      getClassWithMaterials(
        classId
      );

    if (!classData) {
      throw new Error(
        "Class not found"
      );
    }

    const material =
      getMaterial(
        materialId
      );

    if (!material) {
      return false;
    }

    if (
      material.storedPath &&
      fs.existsSync(
        material.storedPath
      )
    ) {
      fs.unlinkSync(
        material.storedPath
      );
    }

    dbDeleteMaterial(
      materialId
    );

    return true;
  }
);

ipcMain.handle(
  "materials:open",
  async (
    _event,
    materialId
  ) => {
    const material =
      getMaterial(
        materialId
      );

    if (
      !material ||
      !material.storedPath ||
      !fs.existsSync(
        material.storedPath
      )
    ) {
      return false;
    }

    const error =
      await shell.openPath(
        material.storedPath
      );

    if (error) {
      console.error(
        "Failed to open material:",
        error
      );

      return false;
    }

    return true;
  }
);


/* =========================================================
   Flashcards
========================================================= */

ipcMain.handle(
  "flashcards:get-all",
  (
    _event,
    classId = undefined
  ) => {
    return dbGetFlashcardSets(
      classId
    );
  }
);

ipcMain.handle(
  "flashcards:get",
  (
    _event,
    setId
  ) => {
    return dbGetFlashcardSet(
      setId
    );
  }
);

ipcMain.handle(
  "flashcards:generate",
  async (
    _event,
    {
      classId,
      materialId = null,
      count = 10,
    }
  ) => {
    if (!classId) {
      throw new Error(
        "A class is required."
      );
    }

    const classData =
      getClassWithMaterials(
        classId
      );

    if (!classData) {
      throw new Error(
        "Class not found."
      );
    }

    /*
     * Ask Gemini to generate the
     * flashcard content.
     */
    const generated =
      await generateFlashcards({
        classData,
        materialId,
        count,
      });

    const now =
      new Date().toISOString();

    /*
     * Convert Gemini's result into
     * our SQLite flashcard-set shape.
     */
    const flashcardSet = {
      id: crypto.randomUUID(),

      classId,

      title:
        generated.title,

      createdAt: now,

      updatedAt: now,

      cards:
        generated.cards.map(
          (card, index) => ({
            id:
              crypto.randomUUID(),

            front:
              card.front,

            back:
              card.back,

            position:
              index,

            createdAt:
              now,
          })
        ),
    };

    /*
     * Save the set + all cards
     * to SQLite.
     */
    const saved =
      dbCreateFlashcardSet(
        flashcardSet
      );

    console.log(
      `Created flashcard set "${saved.title}" with ${saved.cards.length} cards`
    );

    return saved;
  }
);

ipcMain.handle(
  "flashcards:delete",
  (
    _event,
    setId
  ) => {
    return dbDeleteFlashcardSet(
      setId
    );
  }
);

//quizzes

ipcMain.handle(
  "quizzes:get-all",
  (
    _event,
    classId = undefined
  ) => {
    return dbGetQuizzes(
      classId
    );
  }
);

ipcMain.handle(
  "quizzes:get",
  (
    _event,
    quizId
  ) => {
    return dbGetQuiz(
      quizId
    );
  }
);

ipcMain.handle(
  "quizzes:generate",
  async (
    _event,
    {
      classId,
      materialId = null,
      count = 10,
    }
  ) => {
    if (!classId) {
      throw new Error(
        "A class is required."
      );
    }

    const classData =
      getClassWithMaterials(
        classId
      );

    if (!classData) {
      throw new Error(
        "Class not found."
      );
    }

let generated;

try {
  generated =
    await generateQuiz({
      classData,
      materialId,
      count,
    });
} catch (error) {
  if (error?.status === 429) {
    throw new Error(
      "Gemini's free usage limit has been reached. Try generating the quiz again later."
    );
  }

  if (error?.status === 503) {
    throw new Error(
      "Gemini is temporarily busy. Try again shortly."
    );
  }

  throw error;
}

    const now =
      new Date().toISOString();

    const quiz = {
      id:
        crypto.randomUUID(),

      classId,

      title:
        generated.title,

      createdAt:
        now,

      updatedAt:
        now,

      questions:
        generated.questions.map(
          (
            question,
            index
          ) => ({
            id:
              crypto.randomUUID(),

            question:
              question.question,

            choices:
              question.choices,

            correctAnswer:
              question.correctAnswer,

            explanation:
              question.explanation,

            type:
              "multiple-choice",

            position:
              index,
          })
        ),
    };

    const saved =
      dbCreateQuiz(
        quiz
      );

    console.log(
      `Created quiz "${saved.title}" with ${saved.questions.length} questions`
    );

    return saved;
  }
);

ipcMain.handle(
  "quizzes:delete",
  (
    _event,
    quizId
  ) => {
    return dbDeleteQuiz(
      quizId
    );
  }
);



ipcMain.handle(
  "quiz-attempts:get-all",
  (
    _event,
    quizId = undefined
  ) => {
    return dbGetQuizAttempts(
      quizId
    );
  }
);

ipcMain.handle(
  "quiz-attempts:create",
  (
    _event,
    {
      quizId,
      score,
      answers,
      startedAt,
      completedAt,
    }
  ) => {
    if (!quizId) {
      throw new Error(
        "A quiz is required."
      );
    }

    return dbCreateQuizAttempt({
      id:
        crypto.randomUUID(),

      quizId,

      score,

      answers:
        answers || {},

      startedAt:
        startedAt ||
        new Date().toISOString(),

      completedAt:
        completedAt ||
        new Date().toISOString(),
    });
  }
);




app.whenReady().then(
  () => {
    ensureStorage();

    createWindow();

    app.on(
      "activate",
      () => {
        if (
          BrowserWindow
            .getAllWindows()
            .length === 0
        ) {
          createWindow();
        }
      }
    );
  }
);

app.on(
  "window-all-closed",
  () => {
    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  }
);