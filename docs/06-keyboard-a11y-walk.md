# Phase 6: Keyboard-Only A11y Walk

Full keyboard navigation audit of every user journey. Test with Tab, Shift+Tab, Enter, Escape, arrow keys, and screen reader (optional). No mouse allowed.

**Test on:** Desktop (Firefox/Chrome) + Mobile (browser/screen reader). Document any failures as issues.

## Test environment setup

1. Open app at http://localhost:3000
2. Disable mouse (or just don't use it) — test entirely via keyboard
3. Use browser DevTools to check focus visibility and aria labels
4. Optional: test with screen reader (NVDA on Windows, VoiceOver on Mac)

## J1: Citizen raises concern (core flow)

**Start:** Public home page (http://localhost:3000)  
**End:** Complaint submitted + confirmation code shown

### Checklist

- [ ] **Home page navigation**
  - [ ] Tab from top — first focusable element should be meaningful (logo, nav, or main CTA)
  - [ ] "Raise a Concern" button is reachable via Tab and activatable via Enter
  - [ ] Focus ring is visibly different from unfocused state
  - [ ] Skip to main content link present (or Tab lands immediately on main content, not nav)

- [ ] **Raise wizard — Step 1 (What's the issue?)**
  - [ ] Category button grid is keyboard navigable — Tab through each, Enter selects
  - [ ] Selected category has `aria-pressed="true"`
  - [ ] All category buttons have visible focus
  - [ ] Title input focusable and labelled (associated with `<label htmlFor>`)
  - [ ] Description textarea focusable and labelled
  - [ ] Form validation errors announced via `aria-live` when advancing
  - [ ] Next button reachable and activatable via Enter

- [ ] **Raise wizard — Step 2 (Where?)**
  - [ ] "Use My Location" button reachable via Tab and activatable via Enter
  - [ ] Address input labelled and focusable
  - [ ] Landmark input labelled and focusable
  - [ ] Filled location coordinates displayed (no interactive map yet, so Tab should skip map area)
  - [ ] Next button reachable

- [ ] **Raise wizard — Step 3 (Review)**
  - [ ] All review fields readable and not interactive (summary only)
  - [ ] Send button reachable via Tab and activatable via Enter
  - [ ] Loading state: spinner icon has `aria-hidden` (text "Sending..." should be announced instead)

- [ ] **Confirmation**
  - [ ] Complaint code copy button reachable and activatable
  - [ ] Track link reachable via Tab and activatable via Enter
  - [ ] Toast notification announced (sonner toasts should have `role="status"`)

## J2: Track complaint by code (citizen, public)

**Start:** Public home → Track  
**End:** Complaint detail page

- [ ] **Track page**
  - [ ] Code input focusable and labelled
  - [ ] Search button reachable via Tab and activatable via Enter
  - [ ] Error messages announced when code not found

- [ ] **Complaint detail (citizen view)**
  - [ ] Title, category, status visible and labelled
  - [ ] Timeline entries readable (no clicks needed to expand; if expandable, keyboard accessible)
  - [ ] Feedback form inputs labelled
  - [ ] "Reopen" button reachable if status is CLOSED
  - [ ] "Confirm Fixed" button reachable if status is CLOSED

## J3: Officer triage & assignment

**Start:** Log in as office staff → Triage dashboard  
**End:** Complaint assigned and categorized

- [ ] **Triage board**
  - [ ] Complaint list rows are focusable (if list is interactive, e.g., bulk select)
  - [ ] Checkboxes labelled with complaint code (aria-label)
  - [ ] Bulk select checkboxes toggle with Space key
  - [ ] All triage action buttons reachable via Tab

- [ ] **Complaint detail (staff view)**
  - [ ] "Acknowledge" button reachable and activatable
  - [ ] "Categorize" dialog opens via button, focus moves to dialog
  - [ ] Category dropdown keyboard navigable (arrow keys or Tab through options)
  - [ ] Priority select keyboard navigable (arrow keys)
  - [ ] Assign dialog keyboard navigable
  - [ ] Dialog Close button (X) or Escape key closes dialog and restores focus to opener
  - [ ] Merge duplicates button accessible

- [ ] **Escalation / Status transitions**
  - [ ] All action buttons labelled clearly (not just icons)
  - [ ] Reason dialogs (Reject, Reopen, etc.) open and focus moves to textarea
  - [ ] Submit button in dialog activatable via Enter

## J4: Field officer flow (PWA / assigned tasks)

**Start:** Log in as field officer → My Tasks  
**End:** Complaint marked complete with proof photo + signature

- [ ] **Task list**
  - [ ] Task cards focusable (Tab to each)
  - [ ] Task title/location/SLA readable
  - [ ] "Start" or "Open" button reachable via Tab and activatable via Enter

- [ ] **Task detail**
  - [ ] Work status, assigned complaint details visible and readable
  - [ ] "Proof capture" button opens camera/file uploader
  - [ ] File input keyboard accessible (if hidden, needs a visible button to trigger)
  - [ ] Signature pad: if keyboard-interactive, test stylus/pointer; if not, ensure button to skip exists
  - [ ] "Complete & Mark Closed" button reachable and activatable via Enter
  - [ ] Offline indicator (if present) announced

## J5: Command palette (all users)

**Start:** Any authenticated page  
**End:** Navigation or action executed

- [ ] **Ctrl/Cmd+K opens palette**
  - [ ] Keyboard shortcut works
  - [ ] Focus moves into search input
  - [ ] Arrow keys navigate suggestions
  - [ ] Enter selects a suggestion
  - [ ] Escape closes palette and restores focus to page

- [ ] **Theme toggle via palette**
  - [ ] "Toggle theme" item navigable and activatable

- [ ] **Search in palette** (future: complaint search)
  - [ ] Type characters, results update
  - [ ] Tab moves to results

## J6: Notifications & alerts

**Start:** Any page with unread notifications  
**End:** Notification marked read

- [ ] **Notification bell**
  - [ ] Bell icon button reachable via Tab and activatable via Enter
  - [ ] Dropdown menu opens and focus stays on menu
  - [ ] "Mark all read" link in header is keyboard accessible
  - [ ] Each notification item is a link, keyboard navigable, activatable via Enter
  - [ ] Escape closes dropdown and restores focus to bell

- [ ] **Toast notifications**
  - [ ] Success/error toasts announced
  - [ ] Close button (if present) reachable

## J7: Forms & inputs (across all flows)

- [ ] **Input labels**
  - [ ] Every input (text, email, select, textarea) has an associated `<label htmlFor="id">`
  - [ ] Errors shown and announced via `aria-live="polite"` or `aria-invalid="true"`

- [ ] **Select dropdowns (Department, Category, Priority, etc.)**
  - [ ] Dropdown opens via Space or Enter (shadcn Select should handle this)
  - [ ] Arrow keys navigate options
  - [ ] Enter selects an option
  - [ ] Escape closes dropdown

- [ ] **Modals & dialogs**
  - [ ] Opening a dialog moves focus into it (usually to the first input or close button)
  - [ ] Tab loops within dialog (does not escape to background page)
  - [ ] Escape closes dialog
  - [ ] Focus returns to the button that opened the dialog

- [ ] **Checkboxes**
  - [ ] Checkbox + label is a focusable unit
  - [ ] Space toggles checkbox
  - [ ] Checked state is announced

## General accessibility requirements

- [ ] **Focus indicators**
  - [ ] Every focusable element has a visible outline (checked: global `focus-visible:outline` in globals.css)
  - [ ] Focus outline is at least 2px and contrasts with background (WCAG 2.4.7)

- [ ] **ARIA attributes**
  - [ ] Buttons have text content or `aria-label`
  - [ ] Icon-only buttons (e.g., close, edit) have `aria-label`
  - [ ] Links have descriptive text (not "Click here")
  - [ ] Form errors use `aria-invalid="true"` and `aria-describedby="errorId"`
  - [ ] Live updates use `aria-live="polite"` or `aria-live="assertive"`

- [ ] **Screen reader testing** (optional but recommended)
  - [ ] Headings are semantic (`<h1>`, `<h2>`, etc.) and in logical order
  - [ ] Page title is descriptive
  - [ ] Form instructions announced before input
  - [ ] Complaint code, status, priority values read correctly

- [ ] **Color not the only signal**
  - [ ] Status chips have text + color (not just color)
  - [ ] Priority badges have text + color
  - [ ] Links are underlined or styled distinctly (not just color)

## Known issues & workarounds

### Not yet keyboard accessible (Phase 6 future work)

- **Leaflet map** (Transformation Map, Phase 4)
  - [ ] Plan: Make map keyboard navigable with arrow keys to pan, +/- for zoom
  - [ ] Alternative: Provide a text-based search/filter for locations

- **Signature pad** (Field officer PWA, Phase 2)
  - [ ] Touch/stylus input required; consider adding a "Skip signature" button or checkbox
  - [ ] Ensure task can still be marked complete without it (falls back to officer's handwriting later)

- **Media uploader drag-and-drop**
  - [ ] Alternative: File `<input type="file">` button is keyboard accessible

## Reporting failures

When you find a keyboard issue:

1. **Document:** Which journey, which step, which element
2. **Describe:** What happens (or doesn't) when you press the key
3. **Severity:** Blocker (can't proceed), Major (workaround exists), Minor (UX friction)

Example:
```
**Issue:** Category buttons in Raise Wizard Step 1 not activatable via Space key
- Journey: J1 (Citizen raises concern)
- Element: Category button grid
- Severity: Blocker
- Fix: Add `onKeyDown` handler to buttons to respond to Space + Enter
```

## Phase 6 gate (M6) re-verification

Before shipping:
- [ ] All journeys above tested end-to-end via keyboard only
- [ ] No blockers; major issues have workarounds
- [ ] Focus visible on all interactive elements
- [ ] Form errors announced
- [ ] Modals trap focus
- [ ] Tested on at least 2 browsers + 1 screen reader (or planned for post-launch)
