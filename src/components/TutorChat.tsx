import {
  useState,
} from "react";

import ChatInput from "./ChatInput";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: {
    materialId: string;
    materialName: string;
    pageNumber: number;
  }[];
};

type TutorChatProps = {
  classId?: string;
  placeholder?: string;
};

function TutorChat({
  classId,
  placeholder = "Ask anything...",
}: TutorChatProps) {
  const [
    messages,
    setMessages,
  ] = useState<Message[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function sendMessage(
    text: string
  ) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    const previousMessages =
      messages;

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );

    setLoading(true);
    setError("");

    try {
      const history =
        previousMessages.map(
          (message) => ({
            role:
              message.role,
            text:
              message.text,
          })
        );

      const response =
        await window.desktop.ai.chat(
          text,
          classId || null,
          history
        );

      const assistantMessage:
        Message = {
          id:
            crypto.randomUUID(),
          role: "assistant",
          text:
            response.text,
          sources:
            response.sources,
        };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ]
      );
    } catch (err) {
      console.error(
        "Tutor request failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tutor-chat">
      {messages.length > 0 && (
        <div className="conversation">
          {messages.map(
            (message) => (
              <div
                key={message.id}
                className={`message ${message.role}`}
              >
                <div className="message-label">
                  {message.role ===
                  "user"
                    ? "You"
                    : "Personal Tutor"}
                </div>

                <div className="message-text">
                  {message.text}
                </div>

                {message.role ===
                  "assistant" &&
                  message.sources &&
                  message.sources
                    .length > 0 && (
                    <div className="message-sources">
                      {uniqueSources(
                        message.sources
                      ).map(
                        (
                          source,
                          index
                        ) => (
                          <span
                            className="source-chip"
                            key={`${source.materialId}-${source.pageNumber}-${index}`}
                          >
                            {
                              source.materialName
                            }{" "}
                            · p.
                            {
                              source.pageNumber
                            }
                          </span>
                        )
                      )}
                    </div>
                  )}
              </div>
            )
          )}

          {loading && (
            <div className="message assistant">
              <div className="message-label">
                Personal Tutor
              </div>

              <div className="typing">
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="chat-error">
              {error}
            </div>
          )}
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={loading}
        placeholder={
          placeholder
        }
      />
    </div>
  );
}

function uniqueSources(
  sources: Message["sources"]
) {
  if (!sources) {
    return [];
  }

  const seen =
    new Set<string>();

  return sources.filter(
    (source) => {
      const key =
        `${source.materialId}-${source.pageNumber}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

export default TutorChat;