import ChatInput from "../components/ChatInput";
import QuickActions from "../components/QuickActions";

type HomeProps = {
  /*
   * undefined = reopen latest
   * null = intentionally blank/new chat
   * string = specific conversation
   */
  conversationId?:
    string | null;

  onConversationChange?: (
    conversationId: string
  ) => void;
};

function Home({
  conversationId,
  onConversationChange,
}: HomeProps) {
  return (
    <div className="home">
      <h1>
        What do you want to learn?
      </h1>

      <ChatInput
        conversationId={
          conversationId
        }
        startNew={
          conversationId ===
          null
        }
        onConversationChange={
          onConversationChange
        }
      />

      <QuickActions />
    </div>
  );
}

export default Home;