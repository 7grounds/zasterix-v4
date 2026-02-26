# Manager Turn-Trigger - Schnell-Referenz

## TL;DR

**Das System funktionierte bereits!** Nur visuelles Feedback wurde verbessert.

---

## Schnellstart mit UUID '19199f1d-e370-4f91-b0a4-2d0b992e5b94'

### 1. Projekt Aktivieren
```
use 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

### 2. Teilnehmer Anzeigen
```
participants
```

### 3. Diskussion Starten
```
Just start session
```

**Erwartete Antwort**:
```
🤔 Manager Alpha is thinking...

👔 **Manager L3**:
Willkommen...

🎓 **Hotel Expert L2**:
Aus Sicht der Hotellerie...

---
📊 Discussion Status:
Next speaker: You
```

---

## Was Passiert Intern

### 1. User Input → API Call
```typescript
POST /api/discussions/19199f1d-e370-4f91-b0a4-2d0b992e5b94
{
  message: "Just start session",
  userId: "user-1"
}
```

### 2. Backend Verarbeitung
```
💬 Save user message to discussion_logs
✅ current_turn_index++
🤖 Generate Manager response (Groq API)
💾 Save Manager response
🤖 Generate Specialist response
💾 Save Specialist response
✅ Update discussion_state
```

### 3. Response → UI
```
👔 Manager: ...
🎓 Specialist 1: ...
🎓 Specialist 2: ...
📊 Next: You
```

---

## Alle Anforderungen ✅

### ✅ 1. Trigger on User Input
- User message → discussion_logs
- current_turn_index++
- Automatische Verarbeitung

### ✅ 2. Manager Wake-up
- Manager antwortet automatisch
- System prompt + Historie → Groq
- Sequentielle Verarbeitung

### ✅ 3. UUID Safety
- UUID validiert
- UUID in allen Logs
- UUID im UI angezeigt

### ✅ 4. Visual Feedback
- "Manager Alpha is thinking..."
- Emoji-Indikatoren
- Agent-Namen angezeigt
- Status-Footer

---

## Console Logs

### Frontend
```
📝 Sending message to discussion API
   Project ID: 19199f1d-...
✅ Discussion updated
   Next speaker: specialist
```

### Backend
```
💬 Saving user message
✅ User message saved
🤖 Generating response for agent: Manager L3
✅ Agent response saved with project_id: 19199f1d-...
```

---

## Wichtige Dateien

### Backend
- `src/core/discussion-engine-v2.ts` - Turn-Logik
- `app/api/discussions/[id]/route.ts` - API Endpoint

### Frontend
- `components/ManagerChat.tsx` - UI Komponente

### Datenbank
- `discussion_state` - Current turn tracking
- `discussion_logs` - Message history
- `discussion_participants` - Speaker order

---

## Code Snippets

### User Message Speichern
```typescript
await saveDiscussionLog({
  projectId: "19199f1d-...",
  agentId: null,
  role: "user",
  content: userMessage,
  turnIndex: state.current_turn_index,
  roundNumber: state.current_round,
});
```

### Turn Index Erhöhen
```typescript
let nextTurnIndex = state.current_turn_index + 1;
if (nextTurnIndex >= participants.length) {
  nextTurnIndex = 0;
  nextRound += 1;
}
```

### Manager Response Generieren
```typescript
const agentResponse = await generateAgentResponse({
  agent,                    // Manager mit system_prompt
  conversationHistory,      // Aus discussion_logs
  rules,                    // Diskussions-Regeln
  projectTopic,            // Projekt-Thema
});
```

---

## Fehlersuche

### Problem: Keine Antwort
**Check**:
1. Projekt UUID korrekt? → `use [UUID]`
2. Teilnehmer vorhanden? → `participants`
3. Console Logs? → F12 Developer Tools

### Problem: UUID Error
**Lösung**: UUID Format validieren
```
Format: 8-4-4-4-12 hex digits
Example: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

### Problem: Status nicht sichtbar
**Lösung**: UI wurde gerade verbessert!
- Update zu neuester Version
- "Manager Alpha is thinking..." sollte erscheinen

---

## Testing

### Quick Test
```bash
# 1. Projekt aktivieren
use 19199f1d-e370-4f91-b0a4-2d0b992e5b94

# 2. Teilnehmer prüfen
participants

# 3. Nachricht senden
Just start session

# 4. Erwartetes Ergebnis
# - "Manager Alpha is thinking..." erscheint
# - Manager antwortet
# - Spezialisten antworten
# - Status zeigt nächsten Sprecher
```

### Verifizierung
```sql
-- Check discussion_logs
SELECT role, content, turn_index, round_number 
FROM discussion_logs 
WHERE project_id = '19199f1d-e370-4f91-b0a4-2d0b992e5b94'
ORDER BY round_number, turn_index;

-- Check discussion_state
SELECT current_turn_index, current_round, is_active
FROM discussion_state
WHERE project_id = '19199f1d-e370-4f91-b0a4-2d0b992e5b94';
```

---

## Zusammenfassung

**Status**: ✅ Vollständig funktionsfähig

**Was funktioniert**:
- ✅ User Input Trigger
- ✅ Manager Wake-up
- ✅ UUID Safety
- ✅ Visual Feedback
- ✅ Sequential Processing
- ✅ State Management

**Was verbessert wurde**:
- ✅ Besseres visuelles Feedback
- ✅ Klarere Agenten-Anzeige
- ✅ Status-Informationen
- ✅ Emoji-Indikatoren

**Dokumentation**:
- `MANAGER_TURN_TRIGGER_GUIDE.md` - Vollständige Anleitung (15KB)
- `TURN_TRIGGER_QUICK_REF.md` - Diese Schnell-Referenz

---

## Nächste Schritte

1. System testen mit UUID '19199f1d-e370-4f91-b0a4-2d0b992e5b94'
2. Weitere Nachrichten senden
3. Diskussions-Flow beobachten
4. Bei Problemen: Console Logs prüfen

**Viel Erfolg! 🎉**
