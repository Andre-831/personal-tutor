import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import "katex/dist/katex.min.css";

type ChatInputProps = {
  classId?: string;

  placeholder?: string;

  conversationId?: string | null;

  /*
   * true means the user explicitly
   * requested a blank conversation.
   */
  startNew?: boolean;

  onConversationChange?: (
    conversationId: string
  ) => void;
};

function ChatInput({
  classId,
  placeholder = "Ask anything...",
  conversationId:
    requestedConversationId,
  startNew = false,
  onConversationChange,
}: ChatInputProps) {
  const [input, setInput] =
    useState("");

  const [
    conversation,
    setConversation,
  ] =
    useState<
      Conversation | null
    >(null);

  const [
    loadingConversation,
    setLoadingConversation,
  ] =
    useState(true);

  const [error, setError] =
    useState("");

  const bottomRef =
    useRef<
      HTMLDivElement | null
    >(null);

  /* =========================
     Load conversation
  ========================= */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingConversation(
        true
      );

      setError("");
      /*
      * User explicitly clicked
      * New Chat.
      */
      if (startNew) {
        if (!cancelled) {
          setConversation(null);
          setLoadingConversation(false);
        }

        return;
      }

      try {
        let result:
          | Conversation
          | null;

        /*
         * If the sidebar explicitly
         * requested a conversation,
         * load that one.
         */
        if (
          requestedConversationId
        ) {
          result =
            await window
              .desktop
              .conversations
              .get(
                requestedConversationId
              );
        } else {
          /*
           * Otherwise reopen the
           * latest chat for this
           * context.
           *
           * Home:
           * classId = null
           *
           * Class:
           * classId = class ID
           */
          result =
            await window
              .desktop
              .conversations
              .getLatest(
                classId ??
                  null
              );
        }

        if (!cancelled) {
          setConversation(
            result
          );
        }
      } catch (err) {
        console.error(
          "Failed to load conversation:",
          err
        );

        if (!cancelled) {
          setError(
            "Failed to load conversation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingConversation(
            false
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    requestedConversationId,
    classId,
    startNew,
  ]);

  /* =========================
     Live updates
  ========================= */

  useEffect(() => {
    const removeListener =
      window
        .desktop
        .conversations
        .onUpdated(
          (
            updatedConversation
          ) => {
            setConversation(
              (current) => {
                /*
                 * Ignore updates for
                 * conversations we're
                 * not currently viewing.
                 */
                if (
                  current?.id !==
                  updatedConversation.id
                ) {
                  return current;
                }

                return (
                  updatedConversation
                );
              }
            );
          }
        );

    return () => {
      removeListener();
    };
  }, []);

  /* =========================
     Auto scroll
  ========================= */

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        behavior:
          conversation
            ?.status ===
          "generating"
            ? "auto"
            : "smooth",
      });
  }, [conversation]);

  /* =========================
     Create conversation
  ========================= */

  async function ensureConversation() {
    if (conversation) {
      return conversation;
    }

    const created =
      await window
        .desktop
        .conversations
        .create(
          classId ??
            null
        );

    setConversation(
      created
    );

    onConversationChange?.(
      created.id
    );

    return created;
  }

  /* =========================
     Send message
  ========================= */

  async function submit() {
    const text =
      input.trim();

    if (!text) {
      return;
    }

    /*
     * Don't submit another
     * prompt to this same chat
     * while Gemini is working.
     */
    if (
      conversation
        ?.status ===
      "generating"
    ) {
      return;
    }

    setInput("");
    setError("");

    try {
      const currentConversation =
        await ensureConversation();

      /*
       * This returns immediately
       * after Electron starts the
       * background AI generation.
       *
       * We do NOT wait for Gemini.
       */
      const updated =
        await window
          .desktop
          .conversations
          .send(
            currentConversation.id,
            text
          );

      setConversation(
        updated
      );
    } catch (err) {
      console.error(
        "Conversation send failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    }
  }

  /* =========================
     Keyboard
  ========================= */

  function handleKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      submit();
    }
  }

  const messages =
    conversation
      ?.messages ?? [];

  const generating =
    conversation
      ?.status ===
    "generating";

  /* =========================
     UI
  ========================= */

  return (
    <div
      className={`tutor-chat ${
        messages.length >
        0
          ? "has-messages"
          : ""
      }`}
    >
      {messages.length >
        0 && (
        <div className="conversation">
          {messages.map(
            (message) => (
              <div
                key={
                  message.id
                }
                className={`message ${message.role}`}
              >
                <div className="message-label">
                  {message.role ===
                  "user"
                    ? "You"
                    : "Personal Tutor"}
                </div>

                <div className="message-text">
                  {message.role ===
                  "assistant" ? (
                    message.text ? (
                      <ReactMarkdown
                        remarkPlugins={[
                          remarkGfm,
                          remarkMath,
                        ]}
                        rehypePlugins={[
                          rehypeKatex,
                        ]}
                      >
                        {
                          message.text
                        }
                      </ReactMarkdown>
                    ) : message.status ===
                      "error" ? (
                      <span className="chat-error">
                        {message.error ??
                          "The tutor request failed."}
                      </span>
                    ) : (
                      <span className="typing">
                        Thinking...
                      </span>
                    )
                  ) : (
                    message.text
                  )}
                </div>

                {/* Sources */}

                {message.role ===
                  "assistant" &&
                  message.sources &&
                  message
                    .sources
                    .length >
                    0 && (
                    <div className="message-sources">
                      {uniqueSources(
                        message.sources
                      ).map(
                        (
                          source
                        ) => (
                          <span
                            className="source-chip"
                            key={
                              source.type ===
                              "document"
                                ? source.materialId
                                : `${source.materialId}-${source.pageNumber}`
                            }
                          >
                            {
                              source.materialName
                            }

                            {source.type ===
                            "document" ? (
                              <>
                                {
                                  " · "
                                }
                                {
                                  source.pageCount
                                }{" "}
                                pages
                              </>
                            ) : (
                              <>
                                {
                                  " · p."
                                }
                                {
                                  source.pageNumber
                                }
                              </>
                            )}
                          </span>
                        )
                      )}
                    </div>
                  )}

                {/* Generation error */}

                {message.status ===
                  "error" &&
                  message.error &&
                  message.text && (
                    <div className="chat-error">
                      {
                        message.error
                      }
                    </div>
                  )}
              </div>
            )
          )}

          {error && (
            <div className="chat-error">
              {error}
            </div>
          )}

          <div
            ref={
              bottomRef
            }
          />
        </div>
      )}

      {/* Input */}

      <div className="chat-box">
        <textarea
          placeholder={
            loadingConversation
              ? "Loading..."
              : placeholder
          }
          rows={1}
          value={
            input
          }
          disabled={
            loadingConversation
          }
          onChange={(
            event
          ) =>
            setInput(
              event
                .target
                .value
            )
          }
          onKeyDown={
            handleKeyDown
          }
        />

        <div className="chat-actions">
          <button
            className="add-button"
            type="button"
          >
            + Add material
          </button>

          <button
            className="send-button"
            type="button"
            disabled={
              loadingConversation ||
              generating ||
              !input.trim()
            }
            onClick={
              submit
            }
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Sources
========================= */

function uniqueSources(
  sources:
    TutorSource[]
) {
  const seen =
    new Set<string>();

  return sources.filter(
    (source) => {
      const key =
        source.type ===
        "document"
          ? source.materialId
          : `${source.materialId}-${source.pageNumber}`;

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

export default ChatInput;