# Participants Display Guide

## Übersicht

Dieses Feature ermöglicht das Anzeigen von Diskussionsteilnehmern direkt im ManagerChat, inklusive JOIN-Daten aus den `agent_templates`.

---

## Verwendung im ManagerChat

### Methode 1: Direkte UUID-Abfrage

Geben Sie einfach eine Projekt-UUID ein:

```
19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

**Ergebnis:**
- Zeigt alle Teilnehmer für dieses Projekt
- Inkludiert: Name, Rolle, Disziplin, Kategorie, sequence_order
- Schlägt vor, das Projekt mit `use [UUID]` zu aktivieren

### Methode 2: Teilnehmer des aktiven Projekts anzeigen

```
participants
```
oder
```
teilnehmer
```

**Voraussetzung:** Ein Projekt muss aktiv sein (via "session" oder "use" Befehl)

### Methode 3: Projekt aktivieren und Teilnehmer anzeigen

```
use 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```
Dann:
```
participants
```

---

## Anzeige-Format

```
🎭 Diskussionsteilnehmer für Projekt 19199f1d-e370-4f91-b0a4-2d0b992e5b94:

Anzahl: 5

1. Manager L3
   Rolle: manager
   Disziplin: manager_logic
   Kategorie: tourism

2. Hotel Expert L2
   Rolle: specialist
   Disziplin: infrastructure
   Kategorie: tourism

3. Guide Expert L2
   Rolle: specialist
   Disziplin: frontend_design
   Kategorie: tourism

4. Tourismus Expert L2
   Rolle: specialist
   Disziplin: infrastructure
   Kategorie: tourism

5. User
   Rolle: user
   Disziplin: N/A

💡 Um dieses Projekt als aktuelles zu verwenden, gib ein: "use 19199f1d-e370-4f91-b0a4-2d0b992e5b94"
```

---

## API-Endpunkt

### GET `/api/discussions/[id]/participants`

**Beispiel-Request:**
```
GET /api/discussions/19199f1d-e370-4f91-b0a4-2d0b992e5b94/participants
```

**Beispiel-Response:**
```json
{
  "status": "success",
  "participants": [
    {
      "id": "participant-uuid-1",
      "role": "manager",
      "sequence_order": 0,
      "agent_id": "agent-uuid-1",
      "name": "Manager L3",
      "discipline": "manager_logic",
      "category": "tourism",
      "level": 3
    },
    {
      "id": "participant-uuid-2",
      "role": "specialist",
      "sequence_order": 1,
      "agent_id": "agent-uuid-2",
      "name": "Hotel Expert L2",
      "discipline": "infrastructure",
      "category": "tourism",
      "level": 2
    },
    // ... weitere Teilnehmer
  ],
  "count": 5
}
```

---

## Datenbank-Abfrage

Der Endpunkt führt folgende JOIN-Abfrage aus:

```sql
SELECT 
  dp.id,
  dp.role,
  dp.sequence_order,
  dp.agent_id,
  at.id,
  at.name,
  at.discipline,
  at.category,
  at.level
FROM discussion_participants dp
LEFT JOIN agent_templates at ON dp.agent_id = at.id
WHERE dp.project_id = '19199f1d-e370-4f91-b0a4-2d0b992e5b94'
ORDER BY dp.sequence_order ASC
```

**Wichtig**: Der JOIN ist als LEFT JOIN implementiert, damit auch User-Teilnehmer (die keine agent_id haben) angezeigt werden.

---

## Felder-Erklärung

### discussion_participants
- `id`: UUID des Teilnehmers
- `role`: Rolle (manager, leader, user, specialist)
- `sequence_order`: Reihenfolge im Diskussionsablauf (0, 1, 2, ...)
- `agent_id`: Referenz zu agent_templates (NULL für user)

### agent_templates (via JOIN)
- `name`: Name des Agenten (z.B. "Manager L3", "Hotel Expert L2")
- `discipline`: Disziplin (z.B. "manager_logic", "infrastructure", "frontend_design")
- `category`: Kategorie (z.B. "tourism", "education")
- `level`: Level des Agenten (0-3, wobei 3 = Manager, 2 = Expert, 1 = Specialist)

---

## turn_index Bestätigung

Die `saveDiscussionLog` Funktion verwendet bereits die korrekte Spalte `turn_index`:

```typescript
await supabase
  .from("discussion_logs")
  .insert({
    project_id: projectId,
    agent_id: agentId,
    role,
    content,
    turn_index: turnIndex,      // ✅ Korrekt
    round_number: roundNumber,
    metadata: {},
  })
```

**Status**: ✅ Keine Korrektur notwendig - bereits korrekt implementiert

---

## Verwendungsbeispiele

### Beispiel 1: Schnelle Überprüfung
```
User: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
System: [Zeigt 5 Teilnehmer mit Details]
```

### Beispiel 2: Projekt wechseln und Teilnehmer anzeigen
```
User: use 19199f1d-e370-4f91-b0a4-2d0b992e5b94
System: Projekt 19199f1d-e370-4f91-b0a4-2d0b992e5b94 ist jetzt aktiv.
User: participants
System: [Zeigt 5 Teilnehmer mit Details]
```

### Beispiel 3: Mehrere Projekte vergleichen
```
User: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
System: [Zeigt Teilnehmer für Projekt 1]
User: c7d2a3a6-ff74-4df4-a06e-2f80df8ed93f
System: [Zeigt Teilnehmer für Projekt 2]
```

---

## Console Logging

Für Debugging-Zwecke werden folgende Log-Nachrichten ausgegeben:

**UUID-Abfrage:**
```
🔍 Checking participants for UUID: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
✅ Participants loaded: 5
```

**Participants-Befehl:**
```
📋 Fetching participants for project: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
✅ Participants loaded: 5
```

**Projekt aktivieren:**
```
✅ Active project set to: 19199f1d-e370-4f91-b0a4-2d0b992e5b94
```

---

## Fehlerbehandlung

### Ungültige UUID
```
User: invalid-uuid-format
System: Error: Ungültiges UUID-Format.
```

### Kein Projekt aktiv
```
User: participants
System: Kein Projekt aktiv. Bitte starte zuerst eine Session.
```

### Projekt nicht gefunden
```
User: 00000000-0000-0000-0000-000000000000
System: Error: Konnte Teilnehmer nicht laden
```

---

## Technische Details

### Datei-Struktur
```
app/api/discussions/[id]/participants/
└── route.ts              # API-Endpunkt

components/
└── ManagerChat.tsx       # UI-Integration

src/core/
├── discussion-engine-v2.ts
└── types/
    └── database.types.ts
```

### TypeScript-Typen
```typescript
type Participant = {
  id: string;
  role: string;
  sequence_order: number;
  agent_id: string | null;
  name: string;
  discipline: string;
  category: string;
  level: number;
};
```

### Supabase Query
```typescript
const { data: participants } = await supabase
  .from("discussion_participants")
  .select(`
    id,
    role,
    sequence_order,
    agent_id,
    agent_templates (
      id,
      name,
      discipline,
      category,
      level
    )
  `)
  .eq("project_id", projectId)
  .order("sequence_order", { ascending: true });
```

---

## Best Practices

1. **UUID-Validierung**: Immer UUID-Format vor API-Calls validieren
2. **LEFT JOIN**: Verwende LEFT JOIN für User-Teilnehmer ohne agent_id
3. **Sequence Order**: Sortiere immer nach `sequence_order ASC`
4. **Error Handling**: Zeige benutzerfreundliche Fehlermeldungen
5. **Console Logging**: Logge alle wichtigen Schritte für Debugging

---

## Zukünftige Erweiterungen

Mögliche Verbesserungen:
- [ ] Filtern nach Rolle (nur Manager, nur Specialists, etc.)
- [ ] Teilnehmer-Details auf Anfrage (vollständiger system_prompt)
- [ ] Statistiken (Anzahl Beiträge pro Teilnehmer)
- [ ] Export-Funktion für Teilnehmerlisten
- [ ] Visualisierung der Diskussionsreihenfolge

---

## Support

Bei Fragen oder Problemen:
1. Console-Logs überprüfen (F12 → Console)
2. Netzwerk-Tab prüfen (API-Calls)
3. Datenbank-Schema verifizieren
4. Diese Dokumentation konsultieren
