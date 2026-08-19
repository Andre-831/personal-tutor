const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

let db = null;



function initializeDatabase(userDataPath) {
  if (db) {
    return db;
  }

  const databasePath = path.join(
    userDataPath,
    "tutor.db"
  );

  console.log(
    "Opening SQLite database:",
    databasePath
  );

  db = new Database(databasePath);



  db.pragma("journal_mode = WAL");

  db.pragma("foreign_keys = ON");

  createTables();

  return db;
}



function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,

      class_id TEXT NOT NULL,

      name TEXT NOT NULL,
      type TEXT NOT NULL,

      size INTEGER DEFAULT 0,

      stored_path TEXT NOT NULL,

      status TEXT DEFAULT 'ready',

      page_count INTEGER DEFAULT 0,

      added_at TEXT NOT NULL,

      FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      material_id TEXT NOT NULL,

      page_number INTEGER,

      chunk_index INTEGER NOT NULL,

      text TEXT NOT NULL,

      FOREIGN KEY (material_id)
        REFERENCES materials(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_material_chunks_material
    ON material_chunks(material_id);

    CREATE INDEX IF NOT EXISTS
      idx_material_chunks_page
    ON material_chunks(
      material_id,
      page_number
    );


    /* =====================================================
       Conversations
    ===================================================== */

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,

      class_id TEXT,

      title TEXT NOT NULL,

      status TEXT DEFAULT 'idle',

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_conversations_class
    ON conversations(class_id);

    CREATE INDEX IF NOT EXISTS
      idx_conversations_updated
    ON conversations(updated_at);


    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,

      conversation_id TEXT NOT NULL,

      role TEXT NOT NULL,

      text TEXT DEFAULT '',

      status TEXT,

      error TEXT,

      created_at TEXT NOT NULL,

      position INTEGER NOT NULL,

      FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_messages_conversation
    ON messages(
      conversation_id,
      position
    );


    CREATE TABLE IF NOT EXISTS message_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      message_id TEXT NOT NULL,

      material_id TEXT,

      material_name TEXT NOT NULL,

      source_type TEXT NOT NULL,

      page_number INTEGER,

      page_count INTEGER,

      position INTEGER NOT NULL,

      FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_message_sources_message
    ON message_sources(
      message_id,
      position
    );


    /* =====================================================
       Flashcards
    ===================================================== */

    CREATE TABLE IF NOT EXISTS flashcard_sets (
      id TEXT PRIMARY KEY,

      class_id TEXT,

      title TEXT NOT NULL,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_flashcard_sets_class
    ON flashcard_sets(class_id);


    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,

      set_id TEXT NOT NULL,

      front TEXT NOT NULL,
      back TEXT NOT NULL,

      position INTEGER NOT NULL,

      created_at TEXT NOT NULL,

      FOREIGN KEY (set_id)
        REFERENCES flashcard_sets(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
      idx_flashcards_set
    ON flashcards(
      set_id,
      position
    );


    /* =====================================================
       Quizzes
    ===================================================== */

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,

      class_id TEXT,

      title TEXT NOT NULL,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,

      quiz_id TEXT NOT NULL,

      question TEXT NOT NULL,

      question_type TEXT NOT NULL,

      choices_json TEXT,

      correct_answer TEXT,

      explanation TEXT,

      position INTEGER NOT NULL,

      FOREIGN KEY (quiz_id)
        REFERENCES quizzes(id)
        ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,

      quiz_id TEXT NOT NULL,

      score REAL,

      answers_json TEXT,

      started_at TEXT NOT NULL,
      completed_at TEXT,

      FOREIGN KEY (quiz_id)
        REFERENCES quizzes(id)
        ON DELETE CASCADE
    );
  `);
}


   //Classes


function getClasses() {
  const classes = db
    .prepare(`
      SELECT
        id,
        name,
        description,
        created_at
      FROM classes
      ORDER BY created_at ASC
    `)
    .all();

  return classes.map(
    mapClassRow
  );
}

function getClass(classId) {
  const row = db
    .prepare(`
      SELECT
        id,
        name,
        description,
        created_at
      FROM classes
      WHERE id = ?
    `)
    .get(classId);

  if (!row) {
    return null;
  }

  return mapClassRow(row);
}

function getClassWithMaterials(
  classId
) {
  const classData =
    getClass(classId);

  if (!classData) {
    return null;
  }

  return {
    ...classData,

    materials:
      getMaterialsForClass(
        classId
      ),
  };
}

function getClassesWithMaterials() {
  return getClasses().map(
    (classData) => ({
      ...classData,

      materials:
        getMaterialsForClass(
          classData.id
        ),
    })
  );
}

function createClass(
  classData
) {
  db.prepare(`
    INSERT INTO classes (
      id,
      name,
      description,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    classData.id,
    classData.name,
    classData.description || "",
    classData.createdAt
  );

  return getClassWithMaterials(
    classData.id
  );
}

function deleteClass(classId) {
  db.prepare(`
    DELETE FROM classes
    WHERE id = ?
  `).run(classId);

  return true;
}

//materials

function getMaterialsForClass(
  classId
) {
  const rows = db
    .prepare(`
      SELECT
        id,
        class_id,
        name,
        type,
        size,
        stored_path,
        status,
        page_count,
        added_at
      FROM materials
      WHERE class_id = ?
      ORDER BY added_at ASC
    `)
    .all(classId);

  return rows.map(
    mapMaterialRow
  );
}

function getMaterial(
  materialId
) {
  const row = db
    .prepare(`
      SELECT
        id,
        class_id,
        name,
        type,
        size,
        stored_path,
        status,
        page_count,
        added_at
      FROM materials
      WHERE id = ?
    `)
    .get(materialId);

  if (!row) {
    return null;
  }

  return mapMaterialRow(row);
}

function createMaterial({
  classId,
  material,
}) {
  const transaction =
    db.transaction(() => {
      db.prepare(`
        INSERT INTO materials (
          id,
          class_id,
          name,
          type,
          size,
          stored_path,
          status,
          page_count,
          added_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        material.id,
        classId,
        material.name,
        material.type,
        material.size || 0,
        material.storedPath,
        material.ingestion?.status ||
          "ready",
        material.ingestion?.pageCount ||
          0,
        material.addedAt
      );

      insertMaterialChunks(
        material.id,
        material.ingestion?.chunks ||
          []
      );
    });

  transaction();

  return getMaterial(
    material.id
  );
}

function insertMaterialChunks(
  materialId,
  chunks
) {
  const statement =
    db.prepare(`
      INSERT INTO material_chunks (
        material_id,
        page_number,
        chunk_index,
        text
      )
      VALUES (?, ?, ?, ?)
    `);

  chunks.forEach(
    (chunk, index) => {
      statement.run(
        materialId,

        chunk.pageNumber ??
          chunk.page ??
          null,

        chunk.chunkIndex ??
          index,

        chunk.text || ""
      );
    }
  );
}

function getMaterialChunks(
  materialId
) {
  return db
    .prepare(`
      SELECT
        id,
        material_id,
        page_number,
        chunk_index,
        text
      FROM material_chunks
      WHERE material_id = ?
      ORDER BY
        page_number ASC,
        chunk_index ASC
    `)
    .all(materialId)
    .map((row) => ({
      id: row.id,

      materialId:
        row.material_id,

      pageNumber:
        row.page_number,

      chunkIndex:
        row.chunk_index,

      text: row.text,
    }));
}

function deleteMaterial(
  materialId
) {
  db.prepare(`
    DELETE FROM materials
    WHERE id = ?
  `).run(materialId);

  return true;
}
//convos

function getConversation(
  conversationId
) {
  const row = db
    .prepare(`
      SELECT
        id,
        class_id,
        title,
        status,
        created_at,
        updated_at
      FROM conversations
      WHERE id = ?
    `)
    .get(conversationId);

  if (!row) {
    return null;
  }

  return mapConversationRow(
    row
  );
}

function getAllConversations() {
  const rows = db
    .prepare(`
      SELECT
        id,
        class_id,
        title,
        status,
        created_at,
        updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `)
    .all();

  return rows.map(
    mapConversationRow
  );
}

function getConversationsForClass(
  classId
) {
  let rows;

  if (classId === null) {
    rows = db
      .prepare(`
        SELECT
          id,
          class_id,
          title,
          status,
          created_at,
          updated_at
        FROM conversations
        WHERE class_id IS NULL
        ORDER BY updated_at DESC
      `)
      .all();
  } else {
    rows = db
      .prepare(`
        SELECT
          id,
          class_id,
          title,
          status,
          created_at,
          updated_at
        FROM conversations
        WHERE class_id = ?
        ORDER BY updated_at DESC
      `)
      .all(classId);
  }

  return rows.map(
    mapConversationRow
  );
}

function saveConversation(
  conversation
) {
  const transaction =
    db.transaction(() => {
      db.prepare(`
        INSERT INTO conversations (
          id,
          class_id,
          title,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)

        ON CONFLICT(id)
        DO UPDATE SET
          class_id =
            excluded.class_id,

          title =
            excluded.title,

          status =
            excluded.status,

          updated_at =
            excluded.updated_at
      `).run(
        conversation.id,
        conversation.classId || null,
        conversation.title,
        conversation.status || "idle",
        conversation.createdAt,
        conversation.updatedAt
      );

      /*
       * Messages are small enough right
       * now that replacing a conversation's
       * message rows keeps this simple and
       * preserves the exact React shape.
       */

      db.prepare(`
        DELETE FROM messages
        WHERE conversation_id = ?
      `).run(
        conversation.id
      );

      const messageStatement =
        db.prepare(`
          INSERT INTO messages (
            id,
            conversation_id,
            role,
            text,
            status,
            error,
            created_at,
            position
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
          )
        `);

      const sourceStatement =
        db.prepare(`
          INSERT INTO message_sources (
            message_id,
            material_id,
            material_name,
            source_type,
            page_number,
            page_count,
            position
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?
          )
        `);

      (
        conversation.messages || []
      ).forEach(
        (message, index) => {
          messageStatement.run(
            message.id,
            conversation.id,
            message.role,
            message.text || "",
            message.status || null,
            message.error || null,
            message.createdAt,
            index
          );

          (
            message.sources || []
          ).forEach(
            (source, sourceIndex) => {
              sourceStatement.run(
                message.id,

                source.materialId ||
                  null,

                source.materialName ||
                  "",

                source.type ||
                  "page",

                source.pageNumber ??
                  null,

                source.pageCount ??
                  null,

                sourceIndex
              );
            }
          );
        }
      );
    });

  transaction();

  return getConversation(
    conversation.id
  );
}

function deleteConversation(
  conversationId
) {
  db.prepare(`
    DELETE FROM conversations
    WHERE id = ?
  `).run(conversationId);

  return true;
}

//flashcard sets

function getFlashcardSets(
  classId = undefined
) {
  let rows;

  if (classId === undefined) {
    rows = db
      .prepare(`
        SELECT *
        FROM flashcard_sets
        ORDER BY updated_at DESC
      `)
      .all();
  } else if (classId === null) {
    rows = db
      .prepare(`
        SELECT *
        FROM flashcard_sets
        WHERE class_id IS NULL
        ORDER BY updated_at DESC
      `)
      .all();
  } else {
    rows = db
      .prepare(`
        SELECT *
        FROM flashcard_sets
        WHERE class_id = ?
        ORDER BY updated_at DESC
      `)
      .all(classId);
  }

  return rows.map(
    (row) =>
      getFlashcardSet(row.id)
  );
}

function getFlashcardSet(
  setId
) {
  const row = db
    .prepare(`
      SELECT *
      FROM flashcard_sets
      WHERE id = ?
    `)
    .get(setId);

  if (!row) {
    return null;
  }

  const cards = db
    .prepare(`
      SELECT *
      FROM flashcards
      WHERE set_id = ?
      ORDER BY position ASC
    `)
    .all(setId);

  return {
    id: row.id,

    classId:
      row.class_id,

    title:
      row.title,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    cards:
      cards.map((card) => ({
        id: card.id,

        setId:
          card.set_id,

        front:
          card.front,

        back:
          card.back,

        position:
          card.position,

        createdAt:
          card.created_at,
      })),
  };
}

function createFlashcardSet(
  flashcardSet
) {
  const transaction =
    db.transaction(() => {
      db.prepare(`
        INSERT INTO flashcard_sets (
          id,
          class_id,
          title,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        flashcardSet.id,
        flashcardSet.classId ||
          null,
        flashcardSet.title,
        flashcardSet.createdAt,
        flashcardSet.updatedAt
      );

      const statement =
        db.prepare(`
          INSERT INTO flashcards (
            id,
            set_id,
            front,
            back,
            position,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);

      (
        flashcardSet.cards || []
      ).forEach(
        (card, index) => {
          statement.run(
            card.id,
            flashcardSet.id,
            card.front,
            card.back,
            card.position ??
              index,
            card.createdAt ||
              flashcardSet.createdAt
          );
        }
      );
    });

  transaction();

  return getFlashcardSet(
    flashcardSet.id
  );
}

function deleteFlashcardSet(
  setId
) {
  db.prepare(`
    DELETE FROM flashcard_sets
    WHERE id = ?
  `).run(setId);

  return true;
}


// quizzes

function getQuizzes(
  classId = undefined
) {
  let rows;

  if (classId === undefined) {
    rows = db
      .prepare(`
        SELECT *
        FROM quizzes
        ORDER BY updated_at DESC
      `)
      .all();
  } else if (classId === null) {
    rows = db
      .prepare(`
        SELECT *
        FROM quizzes
        WHERE class_id IS NULL
        ORDER BY updated_at DESC
      `)
      .all();
  } else {
    rows = db
      .prepare(`
        SELECT *
        FROM quizzes
        WHERE class_id = ?
        ORDER BY updated_at DESC
      `)
      .all(classId);
  }

  return rows
    .map((row) => getQuiz(row.id))
    .filter(Boolean);
}

function getQuiz(quizId) {
  const row = db
    .prepare(`
      SELECT *
      FROM quizzes
      WHERE id = ?
    `)
    .get(quizId);

  if (!row) {
    return null;
  }

  const questions = db
    .prepare(`
      SELECT *
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY position ASC
    `)
    .all(quizId);

  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    questions: questions.map(
      (question) => ({
        id: question.id,

        quizId:
          question.quiz_id,

        question:
          question.question,

        type:
          question.question_type,

        choices:
          question.choices_json
            ? JSON.parse(
                question.choices_json
              )
            : [],

        correctAnswer:
          question.correct_answer,

        explanation:
          question.explanation || "",

        position:
          question.position,
      })
    ),
  };
}

function createQuiz(quiz) {
  const transaction =
    db.transaction(() => {
      db.prepare(`
        INSERT INTO quizzes (
          id,
          class_id,
          title,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        quiz.id,
        quiz.classId || null,
        quiz.title,
        quiz.createdAt,
        quiz.updatedAt
      );

      const statement =
        db.prepare(`
          INSERT INTO quiz_questions (
            id,
            quiz_id,
            question,
            question_type,
            choices_json,
            correct_answer,
            explanation,
            position
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

      (
        quiz.questions || []
      ).forEach(
        (question, index) => {
          statement.run(
            question.id,
            quiz.id,
            question.question,

            question.type ||
              "multiple-choice",

            JSON.stringify(
              question.choices || []
            ),

            String(
              question.correctAnswer
            ),

            question.explanation || "",

            question.position ?? index
          );
        }
      );
    });

  transaction();

  return getQuiz(quiz.id);
}

function deleteQuiz(
  quizId
) {
  db.prepare(`
    DELETE FROM quizzes
    WHERE id = ?
  `).run(quizId);

  return true;
}


// quiz attempts

function getQuizAttempts(
  quizId = undefined
) {
  let rows;

  if (quizId === undefined) {
    rows = db
      .prepare(`
        SELECT *
        FROM quiz_attempts
        ORDER BY started_at DESC
      `)
      .all();
  } else {
    rows = db
      .prepare(`
        SELECT *
        FROM quiz_attempts
        WHERE quiz_id = ?
        ORDER BY started_at DESC
      `)
      .all(quizId);
  }

  return rows.map(
    (row) => ({
      id: row.id,

      quizId:
        row.quiz_id,

      score:
        row.score,

      answers:
        row.answers_json
          ? JSON.parse(
              row.answers_json
            )
          : {},

      startedAt:
        row.started_at,

      completedAt:
        row.completed_at,
    })
  );
}

function createQuizAttempt(
  attempt
) {
  db.prepare(`
    INSERT INTO quiz_attempts (
      id,
      quiz_id,
      score,
      answers_json,
      started_at,
      completed_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    attempt.id,
    attempt.quizId,
    attempt.score,

    JSON.stringify(
      attempt.answers || {}
    ),

    attempt.startedAt,
    attempt.completedAt || null
  );

return {
  id: attempt.id,

  quizId:
    attempt.quizId,

  score:
    attempt.score,

  answers:
    attempt.answers || {},

  startedAt:
    attempt.startedAt,

  completedAt:
    attempt.completedAt || null,
};
}

//row mapping
function mapClassRow(row) {
  return {
    id: row.id,

    name: row.name,

    description:
      row.description || "",

    createdAt:
      row.created_at,
  };
}

function mapMaterialRow(row) {
  const chunks =
    getMaterialChunks(row.id);

  /*
   * Reconstruct the ingestion shape
   * expected by the existing AI code.
   *
   * This lets us migrate to SQLite
   * without rewriting ai.cjs yet.
   */
  return {
    id: row.id,

    name: row.name,

    type: row.type,

    size: row.size,

    storedPath:
      row.stored_path,

    addedAt:
      row.added_at,

    ingestion: {
      status:
        row.status,

      text:
        chunks
          .map(
            (chunk) =>
              chunk.text
          )
          .join("\n\n"),

      pages:
        buildPagesFromChunks(
          chunks
        ),

      chunks,

      pageCount:
        row.page_count,
    },
  };
}

function mapConversationRow(
  row
) {
  const messageRows =
    db.prepare(`
      SELECT
        id,
        role,
        text,
        status,
        error,
        created_at,
        position
      FROM messages
      WHERE conversation_id = ?
      ORDER BY position ASC
    `)
      .all(row.id);

  const sourceStatement =
    db.prepare(`
      SELECT
        material_id,
        material_name,
        source_type,
        page_number,
        page_count,
        position
      FROM message_sources
      WHERE message_id = ?
      ORDER BY position ASC
    `);

  const messages =
    messageRows.map(
      (message) => {
        const sources =
          sourceStatement
            .all(message.id)
            .map(
              (source) => ({
                materialId:
                  source.material_id,

                materialName:
                  source.material_name,

                type:
                  source.source_type,

                pageNumber:
                  source.page_number ??
                  undefined,

                pageCount:
                  source.page_count ??
                  undefined,
              })
            );

        return {
          id: message.id,

          role:
            message.role,

          text:
            message.text || "",

          ...(sources.length
            ? { sources }
            : {}),

          ...(message.status
            ? {
                status:
                  message.status,
              }
            : {}),

          ...(message.error
            ? {
                error:
                  message.error,
              }
            : {}),

          createdAt:
            message.created_at,
        };
      }
    );

  return {
    id: row.id,

    classId:
      row.class_id,

    title:
      row.title,

    messages,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function buildPagesFromChunks(
  chunks
) {
  const pages =
    new Map();

  for (
    const chunk of chunks
  ) {
    const pageNumber =
      chunk.pageNumber;

    if (
      pageNumber === null ||
      pageNumber === undefined
    ) {
      continue;
    }

    if (
      !pages.has(
        pageNumber
      )
    ) {
      pages.set(
        pageNumber,
        []
      );
    }

    pages
      .get(pageNumber)
      .push(chunk.text);
  }

  return [...pages.entries()]
    .sort(
      ([a], [b]) =>
        a - b
    )
    .map(
      ([pageNumber, texts]) => ({
        pageNumber,

        text:
          texts.join("\n"),
      })
    );
}

/* =========================================================
   JSON -> SQLite migration
========================================================= */

function migrateFromJson(
  jsonFilePath
) {
  if (
    !fs.existsSync(
      jsonFilePath
    )
  ) {
    return {
      migrated: false,
      reason:
        "No JSON database found.",
    };
  }

  /*
   * If SQLite already contains data,
   * don't import the JSON again.
   */
  const classCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM classes
    `)
      .get().count;

  const conversationCount =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM conversations
    `)
      .get().count;

  if (
    classCount > 0 ||
    conversationCount > 0
  ) {
    return {
      migrated: false,
      reason:
        "SQLite database already contains data.",
    };
  }

  let data;

  try {
    data =
      JSON.parse(
        fs.readFileSync(
          jsonFilePath,
          "utf8"
        )
      );
  } catch (error) {
    console.error(
      "Could not read old data.json:",
      error
    );

    return {
      migrated: false,
      reason:
        "Could not read JSON database.",
    };
  }

  const classes =
    Array.isArray(
      data.classes
    )
      ? data.classes
      : [];

  const conversations =
    Array.isArray(
      data.conversations
    )
      ? data.conversations
      : [];

  const migration =
    db.transaction(() => {
      for (
        const classData of
        classes
      ) {
        db.prepare(`
          INSERT OR IGNORE INTO classes (
            id,
            name,
            description,
            created_at
          )
          VALUES (?, ?, ?, ?)
        `).run(
          classData.id,
          classData.name,
          classData.description ||
            "",
          classData.createdAt ||
            new Date()
              .toISOString()
        );

        for (
          const material of
          classData.materials ||
          []
        ) {
          db.prepare(`
            INSERT OR IGNORE INTO materials (
              id,
              class_id,
              name,
              type,
              size,
              stored_path,
              status,
              page_count,
              added_at
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `).run(
            material.id,
            classData.id,
            material.name,
            material.type,
            material.size || 0,
            material.storedPath,
            material.ingestion
              ?.status ||
              "ready",
            material.ingestion
              ?.pageCount ||
              0,
            material.addedAt ||
              new Date()
                .toISOString()
          );

          /*
           * Only insert chunks if this
           * material doesn't already have
           * them.
           */
          const existingChunks =
            db.prepare(`
              SELECT COUNT(*) AS count
              FROM material_chunks
              WHERE material_id = ?
            `)
              .get(
                material.id
              ).count;

          if (
            existingChunks === 0
          ) {
            insertMaterialChunks(
              material.id,
              material.ingestion
                ?.chunks ||
                []
            );
          }
        }
      }

      for (
        const conversation of
        conversations
      ) {
        saveConversation(
          conversation
        );
      }
    });

  try {
    migration();
  } catch (error) {
    console.error(
      "JSON -> SQLite migration failed:",
      error
    );

    throw error;
  }

  /*
   * Keep the original JSON as a backup.
   * Do NOT delete it.
   */
  const backupPath =
    `${jsonFilePath}.backup`;

  if (
    !fs.existsSync(
      backupPath
    )
  ) {
    fs.copyFileSync(
      jsonFilePath,
      backupPath
    );
  }

  console.log(
    "JSON -> SQLite migration complete."
  );

  console.log(
    `Migrated ${classes.length} classes and ${conversations.length} conversations.`
  );

  return {
    migrated: true,

    classes:
      classes.length,

    conversations:
      conversations.length,
  };
}



function closeDatabase() {
  if (!db) {
    return;
  }

  db.close();

  db = null;
}


module.exports = {
  initializeDatabase,
  migrateFromJson,
  closeDatabase,

  getClasses,
  getClass,
  getClassWithMaterials,
  getClassesWithMaterials,
  createClass,
  deleteClass,

  getMaterialsForClass,
  getMaterial,
  getMaterialChunks,
  createMaterial,
  deleteMaterial,

  getConversation,
  getAllConversations,
  getConversationsForClass,
  saveConversation,
  deleteConversation,

  getFlashcardSets,
  getFlashcardSet,
  createFlashcardSet,
  deleteFlashcardSet,
  
  getQuizzes,
  getQuiz,
  createQuiz,
  deleteQuiz,

  getQuizAttempts,
  createQuizAttempt,
};