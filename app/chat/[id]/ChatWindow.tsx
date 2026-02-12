/**
 * @MODULE_ID app.chat.window
 * @STAGE admin
 * @DATA_INPUTS ["agent", "ai_model_config", "stream_chunks"]
 * @REQUIRED_TOOLS ["app.chat.interface"]
 */
import ChatInterface from "./ChatInterface";

type ChatWindowProps = {
  agent: Parameters<typeof ChatInterface>[0]["agent"];
};

export default function ChatWindow({ agent }: ChatWindowProps) {
  return <ChatInterface agent={agent} />;
}
