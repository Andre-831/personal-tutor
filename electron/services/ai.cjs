let aiClient = null;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but",
  "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "for", "with",
  "at", "by", "from", "as", "it", "this",
  "that", "these", "those", "what", "why",
  "how", "when", "where", "who", "can",
  "could", "would", "should", "do", "does",
  "did", "about", "me", "my", "i",
  "explain", "tell"
]);

async function getClient() {
  if (aiClient) {
    return aiClient;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing from .env"
    );
  }

  const { GoogleGenAI } =
    await import("@google/genai");

  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return aiClient;
}

function tokenize(text) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  ).filter(
    (word) =>
      word.length > 2 &&
      !STOP_WORDS.has(word)
  );
}

/*
 * Detect requests that need broad document context
 * rather than a few retrieved chunks.
 */
function isBroadMaterialRequest(message) {
  const text = message.toLowerCase();

  const broadPatterns = [
    "summarize",
    "summary",
    "study guide",
    "studyguide",
    "main topics",
    "main points",
    "key topics",
    "key points",
    "overview",
    "review this",
    "review the",
    "whole lecture",
    "entire lecture",
    "whole document",
    "entire document",
    "whole pdf",
    "entire pdf",
  ];

  return broadPatterns.some(
    (pattern) =>
      text.includes(pattern)
  );
}

/*
 * Try to determine whether the user named
 * a specific material.
 *
 * Example:
 * "summarize lecture 27"
 *
 * matches:
 * 130-Lecture-27.pdf
 */
function findMentionedMaterials(
  classData,
  message
) {
  if (!classData) {
    return [];
  }

  const query =
    message.toLowerCase();

  const queryTerms =
    tokenize(query);

  return (
    classData.materials || []
  ).filter((material) => {
    if (
      material.ingestion?.status !==
      "ready"
    ) {
      return false;
    }

    const name =
      material.name
        .toLowerCase()
        .replace(/\.[^.]+$/, "");

    const nameTerms =
      tokenize(name);

    /*
     * Strong number match.
     *
     * "lecture 27"
     * should strongly match
     * "130-Lecture-27.pdf".
     */
    const queryNumbers =
      query.match(/\d+/g) || [];

    const nameNumbers =
      name.match(/\d+/g) || [];

    if (
      queryNumbers.some(
        (number) =>
          nameNumbers.includes(number)
      )
    ) {
      return true;
    }

    /*
     * Otherwise check meaningful
     * filename words.
     */
    return nameTerms.some(
      (term) =>
        queryTerms.includes(term)
    );
  });
}

function findRelevantChunks(
  classData,
  query,
  limit = 6
) {
  if (!classData) {
    return [];
  }

  const queryTerms = [
    ...new Set(
      tokenize(query)
    ),
  ];

  if (
    queryTerms.length === 0
  ) {
    return [];
  }

  const candidates = [];

  for (
    const material of
    classData.materials || []
  ) {
    if (
      material.ingestion?.status !==
      "ready"
    ) {
      continue;
    }

    for (
      const chunk of
      material.ingestion.chunks || []
    ) {
      const chunkText =
        chunk.text || "";

      const words =
        tokenize(chunkText);

      const frequencies =
        new Map();

      for (const word of words) {
        frequencies.set(
          word,
          (
            frequencies.get(word) ||
            0
          ) + 1
        );
      }

      let score = 0;

      for (
        const term of queryTerms
      ) {
        const count =
          frequencies.get(term) ||
          0;

        if (count > 0) {
          score +=
            1 +
            Math.log1p(count);
        }
      }

      if (score > 0) {
        candidates.push({
          score,
          materialId:
            material.id,
          materialName:
            material.name,
          pageNumber:
            chunk.pageNumber,
          text:
            chunkText,
        });
      }
    }
  }

  return candidates
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, limit);
}

/*
 * Get every chunk from selected materials.
 *
 * Used for:
 * - summarize lecture
 * - make study guide
 * - main topics
 * - overview
 */
function getFullMaterialChunks(
  materials
) {
  const chunks = [];

  for (
    const material of materials
  ) {
    for (
      const chunk of
      material.ingestion?.chunks ||
      []
    ) {
      chunks.push({
        materialId:
          material.id,
        materialName:
          material.name,
        pageNumber:
          chunk.pageNumber,
        text:
          chunk.text,
      });
    }
  }

  return chunks;
}

function buildContext(chunks) {
  return chunks
    .map(
      (chunk) =>
        `[Source: ${chunk.materialName}, Page ${chunk.pageNumber}]\n${chunk.text}`
    )
    .join("\n\n");
}

function buildSources(
  chunks,
  mode
) {
  /*
   * For a full-document request,
   * show one source per document
   * instead of one source per page.
   */
  if (mode === "full-material") {
    const materials = new Map();

    for (const chunk of chunks) {
      if (
        !materials.has(
          chunk.materialId
        )
      ) {
        materials.set(
          chunk.materialId,
          {
            materialId:
              chunk.materialId,

            materialName:
              chunk.materialName,

            pageCount: 0,

            type: "document",
          }
        );
      }

      const material =
        materials.get(
          chunk.materialId
        );

      material.pageCount =
        Math.max(
          material.pageCount,
          chunk.pageNumber
        );
    }

    return [
      ...materials.values(),
    ];
  }

  /*
   * Normal RAG question:
   * show the actual retrieved pages.
   */
  const seen = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const key =
      `${chunk.materialId}-${chunk.pageNumber}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    sources.push({
      materialId:
        chunk.materialId,

      materialName:
        chunk.materialName,

      pageNumber:
        chunk.pageNumber,

      type: "page",
    });
  }

  return sources;
}

function selectContext(
  classData,
  message
) {
  if (!classData) {
    return {
      chunks: [],
      mode: "general",
    };
  }

  if (
    isBroadMaterialRequest(
      message
    )
  ) {
    const mentioned =
      findMentionedMaterials(
        classData,
        message
      );

    /*
     * If the user specifically named
     * something like Lecture 27,
     * use that entire material.
     */
    if (mentioned.length > 0) {
      return {
        chunks:
          getFullMaterialChunks(
            mentioned
          ),
        mode: "full-material",
      };
    }

    /*
     * If there's only one uploaded
     * material, a request like
     * "summarize this lecture"
     * clearly refers to it.
     */
    const readyMaterials =
      (
        classData.materials ||
        []
      ).filter(
        (material) =>
          material.ingestion
            ?.status === "ready"
      );

    if (
      readyMaterials.length === 1
    ) {
      return {
        chunks:
          getFullMaterialChunks(
            readyMaterials
          ),
        mode: "full-material",
      };
    }
  }

  return {
    chunks:
      findRelevantChunks(
        classData,
        message
      ),
    mode: "retrieval",
  };
}

async function streamTutorResponse({
  message,
  classData = null,
  history = [],
  onChunk,
}) {
  const ai =
    await getClient();

  const selection =
    selectContext(
      classData,
      message
    );

  const context =
    buildContext(
      selection.chunks
    );

  const systemInstruction = `
You are Personal Tutor, an AI tutor for a university student.

Your goal is to help the student quickly understand concepts, solve problems, and study effectively.

Response style:
- Give concise, direct answers by default.
- Answer the question first.
- Avoid unnecessary introductions or background.
- Use simple language unless technical detail is useful.
- Expand when the student asks for more detail, examples, summaries, study guides, or step-by-step help.
- For simple questions, keep the response short.
- For complex questions, provide enough explanation to fully answer the question.
- Use Markdown when useful.
- Use bullets, headings, examples, equations, or code when they improve clarity.
- Be conversational, not overly formal.

When class material is provided:
- Treat the supplied class material as the primary source.
- Base claims about the class material on what the supplied material actually says.
- Do not invent content or claim that the material contains something it does not.
- You may use general knowledge to clarify a concept, but distinguish it from the supplied material when that distinction matters.
- When summarizing material, preserve its main topics, terminology, and emphasis.
- When asked to summarize an entire lecture or document, synthesize across all supplied pages rather than focusing on only one section.

When tutoring:
- Prioritize understanding over simply giving an answer.
- If the student seems confused, simplify the explanation or use an example.
- For problems, show reasoning or steps when important for learning.
- Do not make responses longer than necessary.
`;

  const previousConversation =
    history
      .slice(-8)
      .map(
        (item) =>
          `${
            item.role === "user"
              ? "Student"
              : "Tutor"
          }: ${item.text}`
      )
      .join("\n\n");

  const prompt = `
${
  context
    ? `CLASS MATERIAL:\n${context}\n\n`
    : ""
}
${
  previousConversation
    ? `RECENT CONVERSATION:\n${previousConversation}\n\n`
    : ""
}
STUDENT QUESTION:
${message}
`;

  console.log(
    `Tutor context mode: ${selection.mode}, ${selection.chunks.length} chunks`
  );

  const stream =
    await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: prompt,

      config: {
        systemInstruction,
      },
    });

  let fullText = "";

  for await (
    const chunk of stream
  ) {
    const text =
      chunk.text || "";

    if (!text) {
      continue;
    }

    fullText += text;

    onChunk(text);
  }

  return {
    text: fullText,

    sources:
      buildSources(
        selection.chunks,
        selection.mode
      ),

    contextMode:
      selection.mode,
  };
}



async function generateFlashcards({
  classData,
  materialId = null,
  count = 10,
}) {
  if (!classData) {
    throw new Error(
      "A class is required to generate flashcards."
    );
  }

  const readyMaterials = (
    classData.materials || []
  ).filter(
    (material) =>
      material.ingestion?.status ===
      "ready"
  );

  if (readyMaterials.length === 0) {
    throw new Error(
      "This class does not have any ready materials."
    );
  }

  /*
   * If a materialId was supplied,
   * generate only from that material.
   *
   * Otherwise use all materials
   * in the class.
   */
  let selectedMaterials =
    readyMaterials;

  if (materialId) {
    selectedMaterials =
      readyMaterials.filter(
        (material) =>
          material.id === materialId
      );

    if (
      selectedMaterials.length === 0
    ) {
      throw new Error(
        "The selected material could not be found."
      );
    }
  }

  const chunks =
    getFullMaterialChunks(
      selectedMaterials
    );

  if (chunks.length === 0) {
    throw new Error(
      "No text was found in the selected material."
    );
  }

  const context =
    buildContext(chunks);

  const ai =
    await getClient();

  /*
   * Keep the requested amount
   * within a reasonable range.
   */
  const cardCount =
    Math.max(
      1,
      Math.min(
        Number(count) || 10,
        50
      )
    );

  const materialNames =
    selectedMaterials
      .map(
        (material) =>
          material.name
      )
      .join(", ");

  const prompt = `
You are creating flashcards for a university student.

CLASS:
${classData.name}

SOURCE MATERIAL:
${materialNames}

CLASS MATERIAL:
${context}

Create exactly ${cardCount} useful study flashcards using ONLY the supplied class material.

STRICT SOURCE-GROUNDING RULES:
- Every fact, term, definition, name, and explanation in a flashcard must be explicitly supported by the supplied class material.
- Preserve the terminology used in the class material whenever possible.
- Do NOT add terminology from your own knowledge, even if it is a standard name for a concept described in the material.
- Do NOT add outside definitions, examples, explanations, interpretations, or background knowledge.
- If the material describes a concept without naming it, describe it using the material's wording rather than supplying a name from outside knowledge.
- Do NOT "improve" or correct the professor's terminology using outside knowledge.
- You may paraphrase the material to make a clear flashcard, but the paraphrase must not introduce new information.
- If a fact cannot be supported by the supplied material, do not create a card about it.

FLASHCARD QUALITY:
- Focus on important concepts, definitions, relationships, processes, examples, and facts that appear in the material.
- Prefer information likely to be useful for studying or an exam.
- Avoid trivial details.
- Avoid duplicate or near-duplicate cards.
- Each front should contain one clear question or prompt.
- Each back should contain a concise but complete answer.
- Do not use Markdown formatting.
- Keep answers reasonably short.

Before returning the cards, internally verify that every card can be justified directly from the supplied class material. Remove or rewrite any card that relies on outside knowledge.

Return ONLY valid JSON.

Use exactly this structure:

{
  "title": "Short descriptive title",
  "cards": [
    {
      "front": "Question",
      "back": "Answer"
    }
  ]
}
`;

  console.log(
    `Generating ${cardCount} flashcards from ${selectedMaterials.length} material(s), ${chunks.length} chunks`
  );

  const response =
    await ai.models.generateContent({
      model: "gemini-3.5-flash",

      contents: prompt,

      config: {
        responseMimeType:
          "application/json",
      },
    });

  const text =
    response.text || "";

  if (!text.trim()) {
    throw new Error(
      "Gemini returned an empty flashcard response."
    );
  }

  let result;

  try {
    result =
      JSON.parse(text);
  } catch (error) {
    console.error(
      "Could not parse flashcard JSON:",
      text
    );

    throw new Error(
      "Gemini returned invalid flashcard data."
    );
  }

  if (
    !result ||
    !Array.isArray(result.cards)
  ) {
    throw new Error(
      "Gemini returned an invalid flashcard set."
    );
  }

  const cards =
    result.cards
      .filter(
        (card) =>
          typeof card.front ===
            "string" &&
          typeof card.back ===
            "string" &&
          card.front.trim() &&
          card.back.trim()
      )
      .slice(
        0,
        cardCount
      )
      .map((card) => ({
        front:
          card.front.trim(),

        back:
          card.back.trim(),
      }));

  if (cards.length === 0) {
    throw new Error(
      "Gemini did not generate any usable flashcards."
    );
  }

  return {
    title:
      typeof result.title ===
        "string" &&
      result.title.trim()
        ? result.title.trim()
        : `${classData.name} Flashcards`,

    cards,

    materialIds:
      selectedMaterials.map(
        (material) =>
          material.id
      ),
  };
}


async function generateQuiz({
  classData,
  materialId = null,
  count = 10,
}) {
  if (!classData) {
    throw new Error(
      "A class is required to generate a quiz."
    );
  }

  const readyMaterials = (
    classData.materials || []
  ).filter(
    (material) =>
      material.ingestion?.status ===
      "ready"
  );

  if (readyMaterials.length === 0) {
    throw new Error(
      "This class does not have any ready materials."
    );
  }

  let selectedMaterials =
    readyMaterials;

  if (materialId) {
    selectedMaterials =
      readyMaterials.filter(
        (material) =>
          material.id === materialId
      );

    if (
      selectedMaterials.length === 0
    ) {
      throw new Error(
        "The selected material could not be found."
      );
    }
  }

  const chunks =
    getFullMaterialChunks(
      selectedMaterials
    );

  if (chunks.length === 0) {
    throw new Error(
      "No text was found in the selected material."
    );
  }

  const context =
    buildContext(chunks);

  const ai =
    await getClient();

  const questionCount =
    Math.max(
      1,
      Math.min(
        Number(count) || 10,
        30
      )
    );

  const materialNames =
    selectedMaterials
      .map(
        (material) =>
          material.name
      )
      .join(", ");

  const prompt = `
You are creating a multiple-choice quiz for a university student.

CLASS:
${classData.name}

SOURCE MATERIAL:
${materialNames}

CLASS MATERIAL:
${context}

Create exactly ${questionCount} useful multiple-choice questions using ONLY the supplied class material.

STRICT SOURCE-GROUNDING RULES:
- Every question and answer must be explicitly supported by the supplied class material.
- Do NOT add facts, terminology, examples, or explanations from outside knowledge.
- Preserve the terminology used in the class material whenever possible.
- You may paraphrase the material, but do not introduce new information.
- If something cannot be supported by the supplied material, do not ask about it.

QUIZ QUALITY:
- Focus on important concepts likely to matter for studying or an exam.
- Avoid trivial questions.
- Avoid duplicate questions.
- Each question must have exactly 4 choices.
- Exactly one choice must be correct.
- Make incorrect choices plausible but clearly incorrect according to the supplied material.
- correctAnswer must be the zero-based index of the correct choice: 0, 1, 2, or 3.
- Give a short explanation of why the correct answer is correct.
- Do not use Markdown formatting.

Before returning the quiz, internally verify every question against the supplied class material.

Return ONLY valid JSON.

Use exactly this structure:

{
  "title": "Short descriptive quiz title",
  "questions": [
    {
      "question": "Question text",
      "choices": [
        "Choice A",
        "Choice B",
        "Choice C",
        "Choice D"
      ],
      "correctAnswer": 0,
      "explanation": "Short explanation"
    }
  ]
}
`;

  console.log(
    `Generating ${questionCount} quiz questions from ${selectedMaterials.length} material(s), ${chunks.length} chunks`
  );

  const response =
    await ai.models.generateContent({
      model:
        "gemini-3.5-flash",

      contents:
        prompt,

      config: {
        responseMimeType:
          "application/json",
      },
    });

  const text =
    response.text || "";

  if (!text.trim()) {
    throw new Error(
      "Gemini returned an empty quiz response."
    );
  }

  let result;

  try {
    result =
      JSON.parse(text);
  } catch (error) {
    console.error(
      "Could not parse quiz JSON:",
      text
    );

    throw new Error(
      "Gemini returned invalid quiz data."
    );
  }

  if (
    !result ||
    !Array.isArray(
      result.questions
    )
  ) {
    throw new Error(
      "Gemini returned an invalid quiz."
    );
  }

  const questions =
    result.questions
      .filter(
        (item) =>
          typeof item.question ===
            "string" &&
          Array.isArray(
            item.choices
          ) &&
          item.choices.length ===
            4 &&
          Number.isInteger(
            item.correctAnswer
          ) &&
          item.correctAnswer >= 0 &&
          item.correctAnswer <= 3
      )
      .slice(
        0,
        questionCount
      )
      .map(
        (item) => ({
          question:
            item.question.trim(),

          choices:
            item.choices.map(
              (choice) =>
                String(
                  choice
                ).trim()
            ),

          correctAnswer:
            item.correctAnswer,

          explanation:
            typeof item.explanation ===
            "string"
              ? item.explanation.trim()
              : "",
        })
      );

  if (
    questions.length === 0
  ) {
    throw new Error(
      "Gemini did not generate any usable quiz questions."
    );
  }

  return {
    title:
      typeof result.title ===
        "string" &&
      result.title.trim()
        ? result.title.trim()
        : `${classData.name} Quiz`,

    questions,

    materialIds:
      selectedMaterials.map(
        (material) =>
          material.id
      ),
  };
}





module.exports = {
  streamTutorResponse,
  generateFlashcards,
  generateQuiz,
};