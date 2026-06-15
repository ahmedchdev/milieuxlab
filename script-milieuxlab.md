# MilieuxLab — Application Script
### Culture Media Manager | Microbiology Analyst Tool

---

## 1. GENERAL INFORMATION

| Field | Detail |
|---|---|
| App Name | MilieuxLab |
| Target User | Microbiology analyst |
| Language | French (UI) |
| Objective | Automatically calculate and track fertility, sterility, expiry, and renewal alert dates for each culture media batch |
| Type | Mobile web application (responsive) |

---

## 2. BUSINESS RULES (Calculation Logic)

### Media Shelf Life
| Media Type | Shelf Life |
|---|---|
| Solid (agar) | 30 days |
| Broth | 15 days |

### Sterility Duration Types
Each medium has its own sterility incubation duration. Two formats are supported:

| Format | Example | How stored |
|---|---|---|
| Fixed (days) | 5 days | Single value in days |
| Fixed (hours) | 24 hours | Single value in hours |
| Range (hours) | 18h – 72h | Min + Max in hours → display Max only |

> **Display rule for ranges:** Only the maximum date is shown as the "Sterility Result Date".  
> **Unit rule:** Range values are always expressed in hours.

### Automatic Date Formulas
| Calculated Date | Formula |
|---|---|
| Fertility result date | Preparation date + Fertility delay (days per strain) |
| Sterility result date | Preparation date + Sterility duration (hours or days, max if range) |
| Expiry date | Preparation date + Shelf life (30d solid / 15d broth) |
| Renewal alert date | Expiry date − Fertility delay − 2 days (buffer margin) |

> **Key principle:** The renewal alert fires early enough so that the fertility test of the **new batch** is completed before the **current batch expires**, with a 2-day safety buffer.

### Buffer Margin
- Fixed at **2 days** to account for unexpected delays.

---

## 3. PRE-CONFIGURED MEDIA

| Medium | Type | Test Strain | Fertility Delay | Sterility Duration | Sterility Format |
|---|---|---|---|---|---|
| TSA | Solid | S. aureus ATCC 6538 | 5 days | 5 days | Fixed (days) |
| MacConkey Agar | Solid | E. coli ATCC 8739 | 2 days | 18h – 72h | Range (hours) |
| Sabouraud | Solid | C. albicans ATCC 10231 | 5 days | 5 days | Fixed (days) |
| Mueller-Hinton | Solid | S. aureus ATCC 25923 | 3 days | 5 days | Fixed (days) |
| TSB (Tryptic Soy Broth) | Broth | S. aureus ATCC 6538 | 5 days | 14 days | Fixed (days) |
| BHI (Brain Heart Infusion) | Broth | S. aureus ATCC 6538 | 5 days | 14 days | Fixed (days) |
| XLD Agar | Solid | Salmonella typhimurium | 2 days | 18h – 24h | Range (hours) |
| Phosphate Buffer Solution | Broth | E. coli ATCC 8739 | 2 days | 18h – 24h | Range (hours) |

> Users can add custom media with their own strains, fertility delay, and sterility duration. Existing media can also be edited.

---

## 4. APPLICATION STRUCTURE

### 4.1 Main Navigation
4 tabs accessible from a sticky top navigation bar:

```
[ Dashboard ]  [ + Register ]  [ Media ]  [ Settings ]
```

---

### 4.2 PAGE 1 — Dashboard

**Purpose:** Overview of all active batches and today's alerts.

#### Alert Banner (shown only when alerts exist)
```
┌──────────────────────────────────────────────┐
│  ⚠ TODAY'S ALERTS                            │
│  🔴 TSA (LOT-001) — EXPIRES TODAY            │
│  🟠 MacConkey — Renewal required (3d left)   │
│  🟡 Sabouraud — Sterility result due today   │
└──────────────────────────────────────────────┘
```

#### Quick Stats (4 tiles)
```
┌────────────┐  ┌────────────┐
│     5      │  │     2      │
│   ACTIVE   │  │  TO WATCH  │
│   BATCHES  │  │            │
└────────────┘  └────────────┘
┌────────────┐  ┌────────────┐
│     1      │  │     0      │
│   URGENT   │  │  EXPIRED   │
│            │  │            │
└────────────┘  └────────────┘
```

#### Batch Card (repeated for each batch)
```
┌──────────────────────────────────────────────┐
│ ║ TSA                             [SOLID]    │
│   🦠 S. aureus ATCC 6538 · LOT-2024-001      │
│                                              │
│  PREPARATION          EXPIRY DATE            │
│  01/06/2025           01/07/2025             │
│                                              │
│  FERTILITY RESULT     STERILITY RESULT       │
│  06/06/2025           06/06/2025             │
│                                              │
│  ⏰ RENEWAL ALERT DATE                       │
│  24/06/2025                                  │
│                                              │
│  [████████████░░░░░░] 70% remaining          │
│  ● In progress — 25 day(s) remaining         │
│                         [Edit]  [Delete]     │
└──────────────────────────────────────────────┘
```

#### Card Left-Border Color Code
| Color | Meaning |
|---|---|
| Green | Batch in progress, no issue |
| Orange | Expiry within 7 days |
| Red | Renewal alert passed — action required |
| Grey (dimmed) | Expired batch (shown only if setting enabled) |

---

### 4.3 PAGE 2 — Register a Batch

**Purpose:** Enter a new batch and instantly preview all calculated dates.

#### Input Form
```
┌──────────────────────────────────────────────┐
│  NEW MEDIA BATCH                             │
│                                              │
│  CULTURE MEDIUM                              │
│  [ TSA (Solid)                    ▼ ]        │
│                                              │
│  BATCH NUMBER (optional)                     │
│  [ LOT-2024-001                    ]         │
│                                              │
│  PREPARATION DATE                            │
│  [ 01/06/2025                      ]         │
└──────────────────────────────────────────────┘
```

#### Auto-calculated Preview (displayed immediately after input)
```
┌──────────────────────────────────────────────┐
│  CALCULATED DATES                            │
│                                              │
│  FERTILITY RESULT     STERILITY RESULT       │
│  06/06/2025           06/06/2025             │
│                                              │
│  EXPIRY DATE          RENEWAL ALERT          │
│  01/07/2025           24/06/2025             │
└──────────────────────────────────────────────┘

           [ SAVE BATCH ]
```

> Dates update in real time as the user selects a medium and preparation date.

---

### 4.4 PAGE 3 — Media Configuration

**Purpose:** View, add, edit, and delete culture media.

#### Media Card (repeated for each medium)
```
┌──────────────────────────────────────────────┐
│  TSA                           [DEFAULT]     │
│                                              │
│  Type : Solid · 30d     Fertility : 5 days  │
│  Strain : S. aureus ATCC 6538               │
│  Sterility : 5 days     Alert at : Day −7   │
│                                [Edit]        │
└──────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────┐
│  MacConkey Agar                [DEFAULT]     │
│                                              │
│  Type : Solid · 30d     Fertility : 2 days  │
│  Strain : E. coli ATCC 8739                 │
│  Sterility : 18h – 72h  Alert at : Day −4   │
│                                [Edit]        │
└──────────────────────────────────────────────┘
```

#### Add / Edit Media Form
```
        [ + Add a custom medium ]

┌──────────────────────────────────────────────┐
│  NEW MEDIUM / EDIT MEDIUM                    │
│                                              │
│  MEDIUM NAME                                 │
│  [ BHI Chocolate Agar             ]          │
│                                              │
│  TYPE                                        │
│  [ Solid (agar) — 30 days         ▼ ]       │
│                                              │
│  FERTILITY TEST STRAIN                       │
│  [ H. influenzae ATCC 10211       ]          │
│                                              │
│  FERTILITY DELAY (days)                      │
│  [ 5                              ]          │
│                                              │
│  STERILITY DURATION FORMAT                   │
│  ( ) Fixed — days   ( ) Fixed — hours        │
│  (●) Range — hours (min / max)               │
│                                              │
│  ┌─────────────┐   ┌─────────────┐           │
│  │ MIN (hours) │   │ MAX (hours) │           │
│  │    18       │   │    72       │           │
│  └─────────────┘   └─────────────┘           │
│                                              │
│           [ SAVE MEDIUM ]                    │
└──────────────────────────────────────────────┘
```

> - **Fixed days:** User enters a single number in days (e.g., 5).
> - **Fixed hours:** User enters a single number in hours (e.g., 24). Converted to date/time at display.
> - **Range hours:** User enters a min and max in hours (e.g., 18 and 72). Only the **maximum** date is shown as the sterility result.
> - All custom and edited media are **saved persistently** on the device.

---

### 4.5 PAGE 4 — Settings

**Purpose:** Configure application preferences.

```
┌──────────────────────────────────────────────┐
│  SETTINGS                                    │
│                                              │
│  Browser notifications          [ ON  ● ]   │
│  Push alerts on app open                    │
│                                              │
│  Show expired batches           [ ● OFF ]   │
│  Keep expired batches visible               │
├──────────────────────────────────────────────┤
│  📋 Active calculation rules:                │
│                                              │
│  • Solid media shelf life  = 30 days        │
│  • Broth shelf life        = 15 days        │
│  • Buffer margin           = 2 days         │
│  • Sterility range display = max date only  │
│  • Renewal alert = Expiry − Fertility − 2d  │
└──────────────────────────────────────────────┘

         [ Delete all batches ]
```

---

## 5. VISUAL DESIGN

### Color Palette
| Role | Color | Usage |
|---|---|---|
| Main background | `#0A0E14` (dark navy) | General background |
| Card surface | `#111820` | Cards and panels |
| Primary accent | `#00C896` (green) | Solid media, OK status |
| Secondary accent | `#0084FF` (blue) | Broth media, sterility dates |
| Warning | `#FFB020` (amber) | Expiry approaching |
| Danger | `#FF4560` (red) | Urgent, alert overdue |
| Primary text | `#E8F0F8` | Standard text |
| Muted text | `#5A7A99` | Labels, subtitles |

### Typography
| Usage | Font | Style |
|---|---|---|
| Titles, buttons | Syne | Bold 700/800 |
| Dates, codes, data | DM Mono | Regular 400 |
| Technical labels | DM Mono | Uppercase + letter-spacing |

### Visual Indicators
- **Horizontal progress bar** under each card → remaining shelf life (green → amber → red)
- **Glowing status dot** → pulses red when urgent
- **Colored vertical stripe** on left edge of each card → batch status at a glance

---

## 6. NOTIFICATION SYSTEM

### Alert Triggers
| Event | Displayed Message |
|---|---|
| Renewal alert date reached | 🔴 "Prepare a new batch — expiry approaching" |
| Fertility result due today | 🟡 "Fertility result expected today" |
| Sterility result due today | 🟡 "Sterility result expected today" |
| Expiry date reached | 🔴 "BATCH EXPIRES TODAY — remove from use" |

### Notification Channels
- Browser push notification on app load (if permission granted)
- Visual alert banner at the top of the Dashboard

---

## 7. DATA STORAGE

- All data saved locally on the device (`localStorage`)
- No internet connection required
- Data persists between sessions
- Full reset available from Settings

---

## 8. MEDIA MANAGEMENT RULES

| Action | Who can do it | Notes |
|---|---|---|
| View media | All users | Default + custom media listed |
| Add custom medium | User | Saved permanently |
| Edit any medium | User | Default media can also be edited |
| Delete custom medium | User | Confirmed with prompt |
| Delete default medium | Not allowed | Marked as DEFAULT — protected |

---

## 9. FULL EXAMPLE — TSA BATCH

| Step | Date | Calculation |
|---|---|---|
| Batch preparation | 01/06/2025 | Manual entry |
| Fertility result | 06/06/2025 | Day + 5 days (S. aureus) |
| Sterility result | 06/06/2025 | Day + 5 days (fixed, days) |
| Expiry date | 01/07/2025 | Day + 30 days (solid) |
| **Renewal alert** | **24/06/2025** | Expiry − 5d fertility − 2d buffer = Day +23 |

> From **24/06/2025**, the app alerts the analyst to prepare a new TSA batch, so the fertility test (5 days) finishes before expiry on 01/07/2025, with a 2-day safety buffer.

---

## 10. FULL EXAMPLE — MacConkey BATCH

| Step | Date / Time | Calculation |
|---|---|---|
| Batch preparation | 01/06/2025 08:00 | Manual entry |
| Fertility result | 03/06/2025 | Day + 2 days (E. coli) |
| Sterility result (max) | 04/06/2025 08:00 | Preparation time + 72h (max of range 18–72h) |
| Expiry date | 01/07/2025 | Day + 30 days (solid) |
| **Renewal alert** | **25/06/2025** | Expiry − 2d fertility − 2d buffer = Day +27 |

> The sterility result display shows only the **maximum date** (72h = Day +3), not the minimum (18h).

---

*Document: MilieuxLab Script v2.0 — Microbiology Analyst Tool*
