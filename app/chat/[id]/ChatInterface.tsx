/**
 * @MODULE_ID app.chat.interface
 * @STAGE admin
 * @DATA_INPUTS ["agent", "chat_input"]
 * @REQUIRED_TOOLS ["app.api.chat"]
 */
"use client";

import { FormEvent, useMemo, useState } from "react";

type AgentRecord = {
  id: string;
  name: string;
  level: number;
  category: string;
  systemPrompt: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  meta?: string;
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ChatInterface({ agent }: { agent: AgentRecord }) {
  const initialMessages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "seed-assistant",
        role: "assistant",
        content: `Dunkelmodus fuer Zasterix Origo OS ist aktiv. Die Hierarchie-Ebene ${agent.level} ist zur Analyse bereit. Wie lautet der naechste Befehl?`,
        meta: `Node: ${agent.category}`,
      },
      {
        id: "seed-user",
        role: "user",
        content: "Initialisiere das Management-Board und bereite die Kunden-Chatboxen vor.",
        meta: "Status: Delivered",
      },
    ],
    [agent.category, agent.level],
  );

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
      meta: "Status: Sent",
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          systemPrompt: agent.systemPrompt,
          agentName: agent.name,
        }),
      });

      const payload = (await response.json()) as {
        text?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed");
      }

      const aiMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: payload.text?.trim() || "Keine Antwort erhalten.",
        meta: `Node: ${agent.category}`,
      };

      setMessages((previous) => [...previous, aiMessage]);
    } catch (error: unknown) {
      const fallbackText =
        error instanceof Error
          ? `Kommunikationsfehler: ${error.message}`
          : "Kommunikationsfehler mit dem Agenten.";
      const aiFallback: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: fallbackText,
        meta: "Node: fallback",
      };
      setMessages((previous) => [...previous, aiFallback]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
        }}
      />

      <div className="scrollbar-thin scrollbar-thumb-[#374045] z-10 flex flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-[8%]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`max-w-[86%] md:max-w-[65%] ${isUser ? "self-end" : "self-start"}`}
              >
                <div
                  className={
                    isUser
                      ? "rounded-2xl rounded-tr-none border border-[#056162] bg-[#056162] p-5 shadow-md"
                      : "rounded-2xl rounded-tl-none border border-[#222d34] bg-[#202c33] p-5 shadow-md"
                  }
                >
                  <p className="text-[15px] leading-relaxed text-[#e9edef]">{message.content}</p>
                  {message.meta ? (
                    <span
                      className={`mt-2 block text-right font-mono text-[9px] uppercase text-[#8696a0] ${isUser ? "" : "text-left"}`}
                    >
                      {message.meta}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer
        className="z-10 border-t border-[#222d34] bg-[#202c33] px-3 py-3 sm:px-4 md:px-8"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <form
          className="mx-auto flex w-full max-w-5xl items-center gap-3 md:gap-4"
          onSubmit={handleSubmit}
          autoComplete="off"
        >
          <div className="focus-within:border-[#00a884]/50 flex flex-1 items-center rounded-2xl border border-[#2a3942] bg-[#2a3942] px-6 py-4 transition-all">
            <input
              type="text"
              placeholder={`Nachricht an ${agent.name}...`}
              className="w-full border-none bg-transparent text-sm text-[#e9edef] outline-none placeholder-[#8696a0] focus:ring-0"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isSending}
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center rounded-2xl bg-[#00a884] p-4 text-white shadow-lg transition-all hover:bg-[#008f6f] active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Nachricht senden"
            disabled={isSending || !input.trim()}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
            </svg>
          </button>
        </form>
      </footer>
    </>
  );
}
