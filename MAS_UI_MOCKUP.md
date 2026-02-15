# MAS Discussion System - UI Mockup

## Manager Alpha Interface - Flow Visualization

### Screen 1: Initial State
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                    [●] normal           ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager Alpha]                              08:30         │ ║
║  │ Manager Alpha hier. Ich kann Projekte koordinieren und    │ ║
║  │ Diskussionen initiieren. Schreibe 'discussion' oder       │ ║
║  │ 'meeting' um eine strukturierte Multi-Agent Diskussion    │ ║
║  │ zu starten.                                                │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Message Manager Alpha...                  ] [Send]           ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 2: User Initiates Discussion
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                    [●] initiation       ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager Alpha]                              08:30         │ ║
║  │ Manager Alpha hier. Ich kann Projekte koordinieren...     │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:32         │ ║
║  │ I want a discussion about improving tourism revenue in    │ ║
║  │ the Berner Oberland region during winter season          │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager Alpha]                              08:32         │ ║
║  │ Verstanden. Ich rufe den Discussion Leader für diese      │ ║
║  │ wichtige Diskussion. Einen Moment bitte...                │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║             [Processing...]                                     ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Message Manager Alpha...                  ] [Send]           ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 3: Discussion Leader Proposes Configuration
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                    [●] confirmation     ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:32         │ ║
║  │ I want a discussion about improving tourism revenue...    │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager Alpha]                              08:32         │ ║
║  │ Verstanden. Ich rufe den Discussion Leader...             │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Discussion Leader]                          08:32         │ ║
║  │                                                             │ ║
║  │ VORSCHLAG:                                                  │ ║
║  │ Thema: Winter-Tourismus-Strategie Berner Oberland          │ ║
║  │ Agenten: Manager L3, Hotel Expert L2, Tourismus Expert L2, │ ║
║  │          Guide Expert L2                                    │ ║
║  │ Regeln: 3 Zeilen pro Beitrag, 3 Runden                    │ ║
║  │ Teilnehmer: Agenten + Du selbst                            │ ║
║  │                                                             │ ║
║  │ Bist du einverstanden? (Antworte mit 'ja' oder 'bestätigt'│ ║
║  │ zum Starten)                                                │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Type 'ja' or 'bestätigt' to confirm...    ] [Send]           ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 4: Discussion Starts - Round 1
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                  [●●●] Round 1/3        ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  ┌──────────────────────────────────────────────────────────┐  ║
║  │ Active Discussion                                         │  ║
║  │ Topic: Winter-Tourismus-Strategie Berner Oberland        │  ║
║  │ Agents: Manager L3, Hotel Expert L2, Tourismus Expert L2,│  ║
║  │         Guide Expert L2                                   │  ║
║  │ Next: You                                                 │  ║
║  └──────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:33         │ ║
║  │ ja                                                          │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager L3]                                 08:33         │ ║
║  │ Willkommen zur Diskussion: Winter-Tourismus Berner        │ ║
║  │ Oberland. Fokus: Umsatzsteigerung Wintersaison. Regeln:  │ ║
║  │ 3 Zeilen pro Person, 3 Runden, User kann jederzeit       │ ║
║  │ reagieren.                                                 │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Hotel Expert L2]                            08:33         │ ║
║  │ Partnerschaften mit lokalen Hotels ausbauen für Package-  │ ║
║  │ Deals. Fokus auf Wellness-Winter-Angebote und Skihütte-  │ ║
║  │ Events. B2B-Plattform für zentrale Buchungsverwaltung.   │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Your contribution to the discussion...    ] [Send]           ║
║                                                                 ║
║  Project ID: 6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df             ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 5: User Participates
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                  [●●●] Round 1/3        ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  ┌──────────────────────────────────────────────────────────┐  ║
║  │ Active Discussion                                         │  ║
║  │ Topic: Winter-Tourismus-Strategie Berner Oberland        │  ║
║  │ Agents: Manager L3, Hotel Expert L2, Tourismus Expert L2,│  ║
║  │         Guide Expert L2                                   │  ║
║  │ Next: Tourismus Expert L2                                 │  ║
║  └──────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Hotel Expert L2]                            08:33         │ ║
║  │ Partnerschaften mit lokalen Hotels ausbauen...            │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:34         │ ║
║  │ Guter Punkt! Wir sollten auch Social Media Marketing für  │ ║
║  │ jüngere Zielgruppen einbeziehen.                          │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Tourismus Expert L2]                        08:34         │ ║
║  │ Destinationsmarketing für Wintererlebnisse verstärken.    │ ║
║  │ Kooperationen mit Skigebieten und Bergbahnen. Regionale  │ ║
║  │ Events und Festivals als Anziehungspunkte nutzen.        │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Your contribution to the discussion...    ] [Send]           ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 6: Discussion Continues Through Rounds
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                  [●●●] Round 2/3        ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  ┌──────────────────────────────────────────────────────────┐  ║
║  │ Active Discussion                                         │  ║
║  │ Topic: Winter-Tourismus-Strategie Berner Oberland        │  ║
║  │ Next: Manager L3                                          │  ║
║  └──────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  ... (previous messages scrolled up) ...                       ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Guide Expert L2]                            08:35         │ ║
║  │ Authentische Alpen-Erlebnisse mit lokalen Guides. Winter-│ ║
║  │ Wanderungen, Schneeschuh-Touren, Kultur-Programme.       │ ║
║  │ Nachhaltige Tourismusangebote für bewusste Reisende.     │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:35         │ ║
║  │ Perfekt! Diese Authentizität ist unser USP.              │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager L3]                                 08:36         │ ║
║  │ Runde 2: Fokus auf Umsetzung. Hotel Expert: B2B-         │ ║
║  │ Plattform Roadmap. Tourismus Expert: Marketing-Budget.   │ ║
║  │ Guide Expert: Guide-Training-Programm definieren.        │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Your contribution to the discussion...    ] [Send]           ║
╚════════════════════════════════════════════════════════════════╝
```

### Screen 7: Round 3 and Final Summary
```
╔════════════════════════════════════════════════════════════════╗
║  MAS Discussion System                  [●] complete           ║
║  Manager Alpha                                                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ... (Round 3 messages) ...                                    ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Guide Expert L2]                            08:38         │ ║
║  │ Guide-Zertifizierung bis März. 10 neue Winter-Touren     │ ║
║  │ entwickeln. Nachhaltigkeit als Kernbotschaft kommunizieren│ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [You]                                        08:38         │ ║
║  │ Sehr gut, lasst uns mit der Umsetzung beginnen!          │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║             [Generating summary...]                             ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [Manager L3 (Summary)]                       08:39         │ ║
║  │                                                             │ ║
║  │ ZUSAMMENFASSUNG:                                            │ ║
║  │ 1. Hotel-Pakete und B2B-Plattform für zentrale Buchung    │ ║
║  │ 2. Destinationsmarketing mit Fokus auf Winterevents       │ ║
║  │ 3. Authentische Guide-Erlebnisse und Nachhaltigkeitstour  │ ║
║  │ 4. Social Media für jüngere Zielgruppen                   │ ║
║  │ 5. Umsetzung Q1: B2B-Plattform, Guide-Training, Marketing │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
║  ┌───────────────────────────────────────────────────────────┐ ║
║  │ [System]                                     08:39         │ ║
║  │ Diskussion abgeschlossen und Zusammenfassung gespeichert. │ ║
║  └───────────────────────────────────────────────────────────┘ ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║  [Message Manager Alpha...                  ] [Send]           ║
║                                                                 ║
║  Project ID: 6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df             ║
╚════════════════════════════════════════════════════════════════╝
```

## Color Scheme

### Message Types:
- **User messages**: Teal/Cyan background (`border-[#056162]/60 bg-[#056162]/20`)
- **Agent messages**: Emerald/Green background (`border-emerald-500/40 bg-emerald-500/10`)
- **System messages**: Yellow/Orange background (`border-yellow-600/40 bg-yellow-900/20`)

### Status Indicators:
- **Normal**: Green dot (`bg-emerald-400`)
- **Processing**: Yellow pulsing dot (`bg-yellow-400 animate-pulse`)
- **Discussion Active**: Green pulsing dot (`bg-green-400 animate-pulse`)

### Discussion Config Box:
- Border: `border-emerald-800/80`
- Background: `bg-emerald-900/20`
- Header text: `text-emerald-400`

## Dashboard Integration

```
╔════════════════════════════════════════════════════════════════╗
║  Zasterix Dashboard                                             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Available Tools                      Quick Access              ║
║                                                                 ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ ║
║  │                 │  │                 │  │                │ ║
║  │ Manager Alpha   │  │  Asset-Check    │  │ Fee-Calculator │ ║
║  │                 │  │                 │  │                │ ║
║  └─────────────────┘  └─────────────────┘  └────────────────┘ ║
║                                                                 ║
║  ┌─────────────────┐                                           ║
║  │                 │                                           ║
║  │    Yuh-Link     │                                           ║
║  │                 │                                           ║
║  └─────────────────┘                                           ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

## Database View After Discussion

### projects table:
```sql
id: 6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df
name: Diskussion: Winter-Tourismus-Strategie Berner Oberland
type: discussion
status: completed
metadata: {
  "rules": ["Jeder Beitrag maximal 3 Zeilen", "3 Runden insgesamt", ...],
  "speaker_order": ["Manager L3", "Hotel Expert L2", ...],
  "agents": ["Manager L3", "Hotel Expert L2", "Tourismus Expert L2", ...],
  "rounds": 3,
  "topic": "Winter-Tourismus-Strategie Berner Oberland",
  "summary": "ZUSAMMENFASSUNG: 1. Hotel-Pakete...",
  "completed_at": "2026-02-15T08:39:00Z"
}
```

### discussion_logs table (sample entries):
```sql
1. project_id: 6e44f3ea..., speaker: Manager L3, content: "Willkommen..."
2. project_id: 6e44f3ea..., speaker: Hotel Expert L2, content: "Partnerschaften..."
3. project_id: 6e44f3ea..., speaker: User, content: "Guter Punkt!..."
4. project_id: 6e44f3ea..., speaker: Tourismus Expert L2, content: "Destinationsmarketing..."
...
15. project_id: 6e44f3ea..., speaker: Manager L3 (Summary), content: "ZUSAMMENFASSUNG..."
```

### universal_history table (sample entries):
```sql
1. payload: { type: "discussion_start", speaker: "Manager L3", round: 1, ... }
2. payload: { type: "discussion_turn", speaker: "Hotel Expert L2", round: 1, ... }
3. payload: { type: "discussion_turn", speaker: "User", round: 1, ... }
...
15. payload: { type: "discussion_summary", speaker: "Manager L3", ... }
```

## Responsive Design Notes

### Mobile View (< 768px):
- Single column layout
- Message containers take full width
- Round indicator moves below title
- Timestamp on separate line in messages
- Input field and button stack vertically

### Tablet View (768px - 1024px):
- Two-column layout for tools on dashboard
- Messages remain full width
- Discussion config box responsive padding

### Desktop View (> 1024px):
- Full layout as shown in mockups
- Three-column tool grid on dashboard
- Optimized spacing and typography

## Accessibility Features

- Semantic HTML elements
- ARIA labels for dynamic content
- Keyboard navigation support
- Screen reader friendly timestamps
- Color contrast meets WCAG AA standards
- Focus indicators on interactive elements

## Performance Considerations

- Virtual scrolling for long discussions (future enhancement)
- Debounced input for better performance
- Optimistic UI updates for user messages
- Lazy loading of historical discussions
- Efficient re-rendering with React.memo

## Browser Compatibility

- Chrome/Edge: Fully supported
- Firefox: Fully supported
- Safari: Fully supported
- Mobile browsers: Tested on iOS Safari and Chrome Android

## Future UI Enhancements

1. **Real-time typing indicators** - Show when agent is "thinking"
2. **Progress bar** - Visual progress through rounds
3. **Agent avatars** - Icons or images for each agent type
4. **Export button** - Download discussion transcript
5. **Reaction emojis** - Quick reactions to messages
6. **Thread view** - Collapse/expand rounds
7. **Search functionality** - Find text in discussion
8. **Dark/light mode** - User preference toggle
