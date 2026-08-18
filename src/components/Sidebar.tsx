import {
  useEffect,
  useState,
} from "react";

export type Page =
  | "home"
  | "classes"
  | "library"
  | "flashcards"
  | "quizzes";

type SidebarProps = {
  currentPage: Page;

  selectedConversationId?:
    string | null;

  onNavigate: (
    page: Page
  ) => void;

  onNewChat: () => void;

  onOpenConversation: (
    conversationId: string
  ) => void;
};

function Sidebar({
  currentPage,
  selectedConversationId,
  onNavigate,
  onNewChat,
  onOpenConversation,
}: SidebarProps) {
  const [
    conversations,
    setConversations,
  ] =
    useState<
      Conversation[]
    >([]);

  async function loadConversations() {
    try {
      const result =
        await window
          .desktop
          .conversations
          .getAll();

      setConversations(
        result
      );
    } catch (error) {
      console.error(
        "Failed to load conversations:",
        error
      );
    }
  }

  /*
   * Load saved conversations when
   * sidebar starts.
   */
  useEffect(() => {
    loadConversations();
  }, []);

  /*
   * Keep Recent updated while Gemini
   * is running or new chats are created.
   */
  useEffect(() => {
    const removeListener =
      window
        .desktop
        .conversations
        .onUpdated(
          (
            updatedConversation
          ) => {
            setConversations(
              (current) => {
                const existing =
                  current.findIndex(
                    (
                      conversation
                    ) =>
                      conversation.id ===
                      updatedConversation.id
                  );

                let next;

                if (
                  existing >= 0
                ) {
                  next =
                    current.map(
                      (
                        conversation
                      ) =>
                        conversation.id ===
                        updatedConversation.id
                          ? updatedConversation
                          : conversation
                    );
                } else {
                  next = [
                    updatedConversation,
                    ...current,
                  ];
                }

                return next.sort(
                  (a, b) =>
                    new Date(
                      b.updatedAt
                    ).getTime() -
                    new Date(
                      a.updatedAt
                    ).getTime()
                );
              }
            );
          }
        );

    return () => {
      removeListener();
    };
  }, []);

  /*
   * Don't show empty conversations
   * in Recent.
   */
  const recentConversations =
    conversations
      .filter(
        (conversation) =>
          conversation
            .messages
            .length >
          0
      )
      .slice(0, 8);

  return (
    <aside className="sidebar">
      <div className="logo">
        Personal Tutor
      </div>

      <button
        className="new-chat"
        onClick={
          onNewChat
        }
      >
        + New chat
      </button>

      <nav className="nav">
        <button
          className={`nav-item ${
            currentPage ===
            "home"
              ? "active"
              : ""
          }`}
          onClick={() =>
            onNavigate(
              "home"
            )
          }
        >
          Home
        </button>

        <button
          className={`nav-item ${
            currentPage ===
            "classes"
              ? "active"
              : ""
          }`}
          onClick={() =>
            onNavigate(
              "classes"
            )
          }
        >
          Classes
        </button>

        <button
          className={`nav-item ${
            currentPage ===
            "library"
              ? "active"
              : ""
          }`}
          onClick={() =>
            onNavigate(
              "library"
            )
          }
        >
          Library
        </button>

        <button
          className={`nav-item ${
            currentPage ===
            "flashcards"
              ? "active"
              : ""
          }`}
          onClick={() =>
            onNavigate(
              "flashcards"
            )
          }
        >
          Flashcards
        </button>

        <button
          className={`nav-item ${
            currentPage ===
            "quizzes"
              ? "active"
              : ""
          }`}
          onClick={() =>
            onNavigate(
              "quizzes"
            )
          }
        >
          Quizzes
        </button>
      </nav>

      <div className="recent">
        <p className="section-label">
          Recent
        </p>

        {recentConversations.length ===
        0 ? (
          <div className="recent-empty">
            No conversations yet
          </div>
        ) : (
          recentConversations.map(
            (
              conversation
            ) => (
              <button
                key={
                  conversation.id
                }
                className={`recent-item ${
                  selectedConversationId ===
                  conversation.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  onOpenConversation(
                    conversation.id
                  )
                }
                title={
                  conversation.title
                }
              >
                <span className="recent-title">
                  {
                    conversation.title
                  }
                </span>

                {conversation.status ===
                  "generating" && (
                  <span className="recent-generating">
                    •
                  </span>
                )}
              </button>
            )
          )
        )}
      </div>

      <button className="settings">
        Settings
      </button>
    </aside>
  );
}

export default Sidebar;