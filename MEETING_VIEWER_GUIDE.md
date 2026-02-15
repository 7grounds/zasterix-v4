# Meeting Summary Viewer - UI Example

## Overview
The Meeting Summary Viewer provides a comprehensive interface to view completed multi-agent discussions with their summaries prominently displayed.

## Page: /meetings (Meeting List)

```
╔════════════════════════════════════════════════════════════════════════════╗
║  Multi-Agent Discussions                                 3 completed       ║
║  Completed Meetings                                                        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ [✓ Completed]  15.02.2026, 08:39                                     │ ║
║  │                                                                        │ ║
║  │ Diskussion: Winter-Tourismus-Strategie Berner Oberland               │ ║
║  │ Topic: improving tourism revenue in winter season                    │ ║
║  │ Participants: Manager L3, Hotel Expert L2, Tourismus Expert L2       │ ║
║  │                                                                        │ ║
║  │ ┌────────────────────────────────────────────────────────────────┐   │ ║
║  │ │ Summary                                                         │   │ ║
║  │ │ ZUSAMMENFASSUNG:                                                │   │ ║
║  │ │ 1. Hotel-Pakete und B2B-Plattform für zentrale Buchung        │   │ ║
║  │ │ 2. Destinationsmarketing mit Fokus auf Winterevents...        │   │ ║
║  │ └────────────────────────────────────────────────────────────────┘   │ ║
║  │                                                            6e44f3ea... │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ [✓ Completed]  14.02.2026, 15:22                                     │ ║
║  │                                                                        │ ║
║  │ Diskussion: Hotel Integration Strategy                               │ ║
║  │ Topic: integrating new hotel booking systems                         │ ║
║  │ Participants: Manager L3, Hotel-Hub-Integrator, Hotel Expert L2     │ ║
║  │                                                                        │ ║
║  │ ┌────────────────────────────────────────────────────────────────┐   │ ║
║  │ │ Summary                                                         │   │ ║
║  │ │ Key decisions: API standardization, phased rollout, training..│   │ ║
║  │ └────────────────────────────────────────────────────────────────┘   │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Active Meetings                                          1 active         ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ [●] In Progress  15.02.2026, 10:15                                   │ ║
║  │ Diskussion: Alpine Experience Design                                 │ ║
║  │ Topic: creating authentic alpine experiences                         │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Page: /meetings/[id] (Individual Meeting Detail)

```
╔════════════════════════════════════════════════════════════════════════════╗
║  [← Back to Meetings]                                                      ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Meeting Details                                    [✓ Completed]          ║
║  Diskussion: Winter-Tourismus-Strategie Berner Oberland                   ║
║                                                                            ║
║  Topic: improving tourism revenue in winter season                        ║
║                                                                            ║
║  Created: 15.02.2026, 08:30    Completed: 15.02.2026, 08:39              ║
║  Messages: 15                                                              ║
║                                                                            ║
║  ┌─────────────────────────────┐  ┌──────────────────────────────────┐   ║
║  │ Participants                │  │ Rules                             │   ║
║  │ • Manager L3                │  │ • Jeder Beitrag maximal 3 Zeilen  │   ║
║  │ • Hotel Expert L2           │  │ • 3 Runden insgesamt             │   ║
║  │ • Tourismus Expert L2       │  │ • Nutzer kann nach jedem Agenten │   ║
║  │ • Guide Expert L2           │  │   kommentieren                   │   ║
║  └─────────────────────────────┘  └──────────────────────────────────┘   ║
╠════════════════════════════════════════════════════════════════════════════╣
║  ✓  Meeting Summary                                                        ║
╠════════════════════════════════════════════════════════════════════════════╣
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                        │ ║
║  │  ZUSAMMENFASSUNG:                                                     │ ║
║  │  1. Hotel-Pakete und B2B-Plattform für zentrale Buchung              │ ║
║  │  2. Destinationsmarketing mit Fokus auf Winterevents                 │ ║
║  │  3. Authentische Guide-Erlebnisse und Nachhaltigkeitstouren         │ ║
║  │  4. Social Media für jüngere Zielgruppen                             │ ║
║  │  5. Umsetzung Q1: B2B-Plattform, Guide-Training, Marketing          │ ║
║  │                                                                        │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║  Generated by Manager L3 (Summary) • 08:39                                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Full Transcript                                         15 messages       ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ MANAGER L3                                               08:30        │ ║
║  │ Willkommen zur Diskussion: Winter-Tourismus Berner Oberland.        │ ║
║  │ Fokus: Umsatzsteigerung Wintersaison. Regeln: 3 Zeilen pro         │ ║
║  │ Person, 3 Runden, User kann jederzeit reagieren.                    │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ HOTEL EXPERT L2                                          08:30        │ ║
║  │ Partnerschaften mit lokalen Hotels ausbauen für Package-Deals.      │ ║
║  │ Fokus auf Wellness-Winter-Angebote und Skihütte-Events.            │ ║
║  │ B2B-Plattform für zentrale Buchungsverwaltung.                      │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ USER                                                     08:31        │ ║
║  │ Guter Punkt! Wir sollten auch Social Media Marketing für            │ ║
║  │ jüngere Zielgruppen einbeziehen.                                     │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ TOURISMUS EXPERT L2                                      08:31        │ ║
║  │ Destinationsmarketing für Wintererlebnisse verstärken.              │ ║
║  │ Kooperationen mit Skigebieten und Bergbahnen.                       │ ║
║  │ Regionale Events und Festivals als Anziehungspunkte nutzen.        │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ USER                                                     08:32        │ ║
║  │ Perfekt! Diese Authentizität ist unser USP.                         │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  ... (10 more messages through 3 rounds) ...                              ║
║                                                                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐ ║
║  │ MANAGER L3 (SUMMARY)                                     08:39        │ ║
║  │ [Summary text as shown above]                                        │ ║
║  └──────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  [Start New Meeting]  [View All Meetings]                                 ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Key Features

### 1. Meeting List Page (`/meetings`)
- **Completed Meetings Section**
  - Shows all finished discussions
  - Summary preview (2 lines with line-clamp)
  - Completion timestamp
  - Participant list
  - Click to view full details

- **Active Meetings Section**
  - Shows in-progress discussions
  - Pulsing indicator
  - Click to resume in Manager Alpha interface

### 2. Meeting Detail Page (`/meetings/[id]`)

#### Header Section
- Back navigation to meetings list
- Meeting name and status badge
- Creation and completion timestamps
- Message count

#### Metadata Cards
- **Participants Card**: List of all agents involved
- **Rules Card**: Discussion rules that were followed

#### Summary Section (Highlighted)
- **Prominent Display**: 
  - Large border with emerald color
  - Gradient background
  - Checkmark icon
  - Larger text for readability
- **Content**: Full summary text with line breaks preserved
- **Metadata**: Generator (Manager L3) and timestamp

#### Full Transcript Section
- All messages in chronological order
- Color-coded by speaker type:
  - User messages: Teal background
  - Manager messages: Emerald background
  - Expert messages: Gray background
- Timestamps for each message
- Whitespace preserved for formatting

#### Action Buttons
- Start New Meeting: Go to Manager Alpha
- View All Meetings: Return to list

## Color Scheme

### Summary Highlight:
- Border: `border-2 border-emerald-500/40`
- Background: `bg-gradient-to-br from-emerald-950/50 to-slate-950`
- Shadow: `shadow-[0_20px_55px_rgba(16,185,129,0.15)]`
- Text: `text-emerald-100`

### Status Badges:
- Completed: `bg-emerald-500/20 text-emerald-300`
- Active: `bg-yellow-500/20 text-yellow-300`

### Message Cards:
- User: `border-[#056162]/60 bg-[#056162]/20`
- Manager: `border-emerald-500/40 bg-emerald-500/10`
- Expert: `border-slate-700 bg-slate-900/80`

## Data Flow

### Meeting List Page:
```typescript
// Fetch from projects table
SELECT id, name, status, created_at, updated_at, metadata
FROM projects
WHERE type = 'discussion'
ORDER BY updated_at DESC
LIMIT 20;

// metadata.summary contains the final summary
// metadata.agents contains participant list
// metadata.completed_at contains completion timestamp
```

### Meeting Detail Page:
```typescript
// Fetch project details
SELECT * FROM projects WHERE id = :id AND type = 'discussion';

// Fetch all discussion messages
SELECT id, speaker_name, content, created_at
FROM discussion_logs
WHERE project_id = :id
ORDER BY created_at ASC;

// Identify summary message
const summaryLog = logs.find(log => 
  log.speaker_name.includes("Summary") || 
  log.speaker_name.includes("Zusammenfassung")
);
```

## Responsive Design

### Mobile View (< 768px):
- Single column layout
- Stacked metadata cards
- Full-width messages
- Compact timestamps

### Tablet View (768px - 1024px):
- Two-column metadata grid
- Slightly larger text
- Better spacing

### Desktop View (> 1024px):
- Full layout as shown
- Optimal reading width for transcript
- Side-by-side metadata cards

## Accessibility

- Semantic HTML structure
- ARIA labels for status badges
- Color contrast meets WCAG AA
- Keyboard navigation support
- Screen reader friendly timestamps
- Focus indicators on interactive elements

## Use Cases

### 1. Post-Meeting Review
User completes a meeting with Manager Alpha and wants to review the decisions made:
1. Click "View Meetings" from dashboard
2. See their completed meeting at the top
3. Click to open full details
4. Read the summary prominently displayed
5. Scroll through transcript if needed

### 2. Historical Reference
User needs to reference a past discussion:
1. Navigate to /meetings
2. Browse list of completed meetings
3. Use summary preview to find relevant meeting
4. Open detail page for full context

### 3. Share with Team
User wants to share meeting outcomes:
1. Open meeting detail page
2. Copy URL to share with colleagues
3. Recipients see formatted meeting with summary
4. Can export/print for documentation

## Future Enhancements

1. **Export Functionality**
   - PDF export with summary highlighted
   - Markdown export for documentation
   - Email summary option

2. **Search & Filter**
   - Search by topic or keywords
   - Filter by date range
   - Filter by participants
   - Filter by status

3. **Analytics**
   - Meeting duration statistics
   - Participation metrics
   - Most active agents
   - Topic trends

4. **Rich Formatting**
   - Syntax highlighting for code in messages
   - Link detection and rendering
   - Emoji support
   - Markdown rendering in messages

5. **Collaboration Features**
   - Comments on meetings
   - Annotations on summary
   - Follow-up action items
   - Task creation from decisions
