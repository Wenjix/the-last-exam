# Design Inspiration: Bento Grid Layout & Spotlight Effect

> Full-page layout system for Patch Battle.
> Defines the bento grid, fixed header, mouse-tracking spotlight, and responsive breakpoints.

## Page Container

```css
.battle-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000000;
  overflow-x: hidden;
  overflow-y: auto;
  z-index: 100;
  font-family: 'Geist Mono', monospace;
  overscroll-behavior: contain;
}
```

## Mouse-Tracking Spotlight

A subtle radial gradient follows the mouse cursor across the entire page.

```css
.battle-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 115;
  background: radial-gradient(
    circle 500px at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255, 255, 255, 0.08) 0%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.battle-container:hover::before {
  opacity: 1;
}
```

JavaScript to drive it:
```javascript
const handleMouseMove = (e) => {
  const container = containerRef.current;
  if (container) {
    container.style.setProperty('--mouse-x', `${e.clientX}px`);
    container.style.setProperty('--mouse-y', `${e.clientY}px`);
  }
};
```

## Bento Box Container

```css
.bento-container {
  position: relative;
  min-height: 100vh;
  width: 100%;
  padding: 20px;
  padding-top: 90px;  /* below fixed header */
  z-index: 110;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}
```

## Fixed Header (90px)

```css
.header-space {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 90px;
  z-index: 120;
  overflow: visible;
}

.header-content {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  z-index: 10;
}

.header-title {
  font-family: 'BBH Sans Bartle', sans-serif;
  font-size: 1.1rem;
  color: white;
  font-weight: 400;
  text-transform: lowercase;
  letter-spacing: 0.15em;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.4);
}

.header-subtitle {
  font-family: 'Geist Mono', monospace;
  font-size: 0.75rem;
  color: white;
  opacity: 0.9;
}
```

## Bento Grid (Base: 4-col)

Base 4-column, 3-row grid pattern:
```css
/* Base 4-col grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 16px;
  perspective: 1000px;
  width: 100%;
  height: calc(100vh - 110px);
}

/* Agent cards: 2x2 in columns 1-2 */
.bento-grid > .glass-card:nth-child(1) { grid-column: 1; grid-row: 1; }
.bento-grid > .glass-card:nth-child(2) { grid-column: 2; grid-row: 1; }
.bento-grid > .glass-card:nth-child(3) { grid-column: 1; grid-row: 2; }
.bento-grid > .glass-card:nth-child(4) { grid-column: 2; grid-row: 2; }

/* Right panel: columns 3-4, rows 1-2 */
.bento-grid > .commentator-card { grid-column: 3 / 5; grid-row: 1 / 3; }

/* Bottom row */
.bento-grid > .chat-input-card { grid-column: 1 / 3; grid-row: 3; }
.bento-grid > .transcript-card { grid-column: 3 / 5; grid-row: 3; }
```

## Adapted Grid for Patch Battle

Patch Battle needs: 2x2 agent cards (left), battle log (right), scoreboard (bottom).

```css
/* Patch Battle adapted layout */
.bento-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  grid-template-rows: 1fr 1fr auto;
  gap: 16px;
  perspective: 1000px;
  width: 100%;
  height: calc(100vh - 110px);
}

/* Agent cards: 2x2 in columns 1-2 */
.bento-grid > .agent-card:nth-child(1) { grid-column: 1; grid-row: 1; }
.bento-grid > .agent-card:nth-child(2) { grid-column: 2; grid-row: 1; }
.bento-grid > .agent-card:nth-child(3) { grid-column: 1; grid-row: 2; }
.bento-grid > .agent-card:nth-child(4) { grid-column: 2; grid-row: 2; }

/* Battle log: right column, spans 2 rows */
.bento-grid > .battle-log { grid-column: 3; grid-row: 1 / 3; }

/* Scoreboard: full width bottom row */
.bento-grid > .scoreboard { grid-column: 1 / 4; grid-row: 3; }
```

## Expansion Behavior

When a card is expanded, it takes over the 2x2 area and dims everything else:

```css
.bento-grid .glass-card.expanded {
  grid-column: 1 / 3;
  grid-row: 1 / 3;
  z-index: 250;
  overflow: hidden;
}

.bento-grid:has(.glass-card.expanded) > *:not(.expanded) {
  filter: blur(2px) brightness(0.5);
  pointer-events: none;
}
```

## Black Fade Overlay (page transition)

```css
.fade-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: black;
}
```

## Responsive: Mobile (768px)

```css
@media (max-width: 768px) {
  .bento-container {
    padding: 4px;
    padding-top: 70px;
  }

  .header-space { height: 70px; }
  .header-text { display: none; }
  .header-logo-loop { display: none; }

  .bento-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 8px;
    height: auto;
  }

  .bento-grid > .glass-card { min-height: 180px; }
}
```
