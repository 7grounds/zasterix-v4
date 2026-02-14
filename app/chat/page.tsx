"use client";
import React, { useState, useEffect, useRef } from 'react';

/** @VERSION Origo-V4-Build-Safe-UI */

// 1. Define the Message Interface to fix the 'any' error
interface Message {
  role: "user" | "assistant" | "system";
  text: string;
  title: string;
}

export default function OrigoChat() {
  // 2. Use the interface here
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    scrollRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages]);

  // 3. Typed API call helper
  const callApi = async (msg: string, title: string, currentHistory: Message[]) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        targetTitle: title,
        history: currentHistory.map(m => ({ role: m.role, content: m.text }))
      }),
    });
    return res.json();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", text: input, title: "OWNER" };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const data = await callApi(input, "Discussion Leader", updatedMessages);
      const leaderMsg: Message = { role: "assistant", text: data.text, title: data.title };
      setMessages(prev => [...prev, leaderMsg]);

      let specialist = "";
      if (data.text.toLowerCase().includes("software developer")) specialist = "Software Developer";
      else if (data.text.toLowerCase().includes("marketing expert")) specialist = "Marketing Expert";

      if (specialist) {
        const specData = await callApi(`The Leader requested your input regarding: ${input}`, specialist, [...updatedMessages, leaderMsg]);
        const specMsg: Message = { role: "assistant", text: specData.text, title: specData.title };
        setMessages(prev => [...prev, specMsg]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "system", text: "Link Error.", title: "SYSTEM" }]);
    } finally {
      setLoading(false);
    }
  };

  // ... (rest of your return JSX stays exactly the same)
