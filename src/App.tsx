import { useState } from "react";
import "./App.css";

import Sidebar, {
  type Page,
} from "./components/Sidebar";

import Home from "./pages/Home";
import Classes from "./pages/Classes";
import Library from "./pages/Library";
import Flashcards from "./pages/Flashcards";
import Quizzes from "./pages/Quizzes";

function App() {
  const [
    currentPage,
    setCurrentPage,
  ] = useState<Page>("home");

  /*
   * null:
   * new/blank conversation
   *
   * string:
   * current conversation
   */
  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<string | null>(null);


  function handleNavigate(
    page: Page
  ) {
    setCurrentPage(page);
  }

 //start new blank chat
  function handleNewChat() {
    setSelectedConversationId(null);
    setCurrentPage("home");
  }


  function handleOpenConversation(
    conversationId: string
  ) {
    setSelectedConversationId(
      conversationId
    );

    setCurrentPage("home");
  }

  function renderPage() {
    switch (currentPage) {
      case "classes":
        return <Classes />;

      case "library":
        return <Library />;

      case "flashcards":
        return <Flashcards />;

      case "quizzes":
        return <Quizzes />;

      default:
        return (
          <Home
            conversationId={
              selectedConversationId
            }
            onConversationChange={
              setSelectedConversationId
            }
          />
        );
    }
  }

  return (
    <div className="app">
      <div className="window-drag-region" />

      <Sidebar
        currentPage={
          currentPage
        }
        selectedConversationId={
          selectedConversationId
        }
        onNavigate={
          handleNavigate
        }
        onNewChat={
          handleNewChat
        }
        onOpenConversation={
          handleOpenConversation
        }
      />

      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;