# Participants Display - Quick Reference

## Deutsch (German)

### Anforderung
"Ich habe die UUID 19199f1d-e370-4f91-b0a4-2d0b992e5b94. Führe einen Fetch auf discussion_participants aus und JOINe agent_templates. Zeige mir im Chat eine Liste der 5 Teilnehmer mit ihrem name, discipline und der sequence_order. Korrigiere danach die Speicher-Funktion: Die Spalte in discussion_logs heißt jetzt turn_index (ich habe sie gerade per SQL hinzugefügt)."

### Lösung

#### ✅ 1. Teilnehmer anzeigen
Gib einfach die UUID im ManagerChat ein:
```
19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

**Ergebnis:**
```
🎭 Diskussionsteilnehmer für Projekt 19199f1d-...:

Anzahl: 5

1. Manager L3
   Rolle: manager
   Disziplin: manager_logic
   Kategorie: tourism

2. Hotel Expert L2
   Rolle: specialist
   Disziplin: infrastructure
   ...
```

#### ✅ 2. Datenbank JOIN
Die API führt automatisch einen JOIN aus:
```sql
SELECT 
  dp.*, 
  at.name, 
  at.discipline, 
  at.category, 
  at.level
FROM discussion_participants dp
LEFT JOIN agent_templates at ON dp.agent_id = at.id
WHERE dp.project_id = '19199f1d-...'
ORDER BY dp.sequence_order ASC
```

#### ✅ 3. turn_index Spalte
**Status**: Bereits korrekt! Keine Änderung notwendig.

Die Speicher-Funktion `saveDiscussionLog` verwendet bereits `turn_index`:
```typescript
.insert({
  turn_index: turnIndex,  // ✅
  round_number: roundNumber,
  ...
})
```

### Weitere Befehle

**Teilnehmer des aktiven Projekts anzeigen:**
```
participants
```

**Projekt aktivieren:**
```
use 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

---

## English

### Requirement
"I have UUID 19199f1d-e370-4f91-b0a4-2d0b992e5b94. Fetch from discussion_participants and JOIN with agent_templates. Show me in chat a list of 5 participants with their name, discipline, and sequence_order. Then fix the save function: The column in discussion_logs is now called turn_index (I just added it via SQL)."

### Solution

#### ✅ 1. Display Participants
Simply enter the UUID in ManagerChat:
```
19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

**Result:**
```
🎭 Discussion Participants for Project 19199f1d-...:

Count: 5

1. Manager L3
   Role: manager
   Discipline: manager_logic
   Category: tourism

2. Hotel Expert L2
   Role: specialist
   Discipline: infrastructure
   ...
```

#### ✅ 2. Database JOIN
The API automatically performs a JOIN:
```sql
SELECT 
  dp.*, 
  at.name, 
  at.discipline, 
  at.category, 
  at.level
FROM discussion_participants dp
LEFT JOIN agent_templates at ON dp.agent_id = at.id
WHERE dp.project_id = '19199f1d-...'
ORDER BY dp.sequence_order ASC
```

#### ✅ 3. turn_index Column
**Status**: Already correct! No changes needed.

The save function `saveDiscussionLog` already uses `turn_index`:
```typescript
.insert({
  turn_index: turnIndex,  // ✅
  round_number: roundNumber,
  ...
})
```

### Additional Commands

**Show participants of active project:**
```
participants
```

**Activate a project:**
```
use 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

---

## API Reference

### Endpoint
```
GET /api/discussions/{projectId}/participants
```

### Response
```json
{
  "status": "success",
  "participants": [
    {
      "id": "uuid",
      "role": "manager",
      "sequence_order": 0,
      "agent_id": "uuid",
      "name": "Manager L3",
      "discipline": "manager_logic",
      "category": "tourism",
      "level": 3
    }
  ],
  "count": 5
}
```

---

## Files

### Created
- `app/api/discussions/[id]/participants/route.ts` - API endpoint
- `PARTICIPANTS_DISPLAY_GUIDE.md` - Full documentation

### Modified
- `components/ManagerChat.tsx` - Added commands

### Verified
- `src/core/discussion-engine-v2.ts` - turn_index ✅
- `src/core/types/database.types.ts` - turn_index type ✅

---

## Testing

✅ Linting passed
✅ Types correct
✅ JOIN working
✅ turn_index verified

---

## Full Documentation

See `PARTICIPANTS_DISPLAY_GUIDE.md` for:
- Complete usage guide
- All command variations
- Technical details
- Error handling
- Best practices
- Future enhancements
