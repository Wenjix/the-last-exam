# Design Inspiration: Glass Morphism System

> Foundational visual pattern for all cards and inputs in Patch Battle.
> Three-layer glass rendering with backdrop blur, SVG distortion, and specular highlights.

## How It Works

Three-layer rendering on top of a backdrop blur:
1. **glass-filter** — `backdrop-filter: blur()` + SVG distortion filter
2. **glass-overlay** — semi-transparent background color
3. **glass-specular** — inset box-shadow for light reflection
4. **glass-content** — actual content (highest z-index)

Requires an SVG filter defined in `index.html`:
```html
<svg width="0" height="0" style="position: absolute;">
  <filter id="glass-distortion">
    <feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
  </filter>
</svg>
```

## JSX Pattern

```jsx
<div className="glass-card">
  <div className="glass-filter" />
  <div className="glass-overlay" />
  <div className="glass-specular" />
  <div className="glass-content">
    {/* actual content here */}
  </div>
</div>
```

## CSS: Glass Card (from AgentCard.css)

```css
.glass-card {
  --bg-color: rgba(0, 0, 0, 0.4);
  --highlight: rgba(255, 255, 255, 0.25);

  position: relative;
  border-radius: 12px;
  overflow: visible;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 14px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
  transform-style: preserve-3d;
  z-index: 1;
}

/* Border glow edge */
.glass-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255, 70, 110, 0.4), rgba(255, 255, 255, 0.2), rgba(255, 70, 110, 0.4));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.glass-card:hover::after {
  opacity: 1;
  background: linear-gradient(135deg, rgba(255, 70, 110, 0.8), rgba(255, 255, 255, 0.4), rgba(255, 70, 110, 0.8));
}

.glass-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 70, 110, 0.3);
}

/* Three glass layers */
.glass-card .glass-filter,
.glass-card .glass-overlay,
.glass-card .glass-specular {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
}

.glass-card .glass-filter {
  z-index: 1;
  backdrop-filter: blur(16px);
  filter: url(#glass-distortion) saturate(140%) brightness(1.05);
}

.glass-card .glass-overlay {
  z-index: 2;
  background: var(--bg-color);
  transition: background 0.6s ease;
}

.glass-card .glass-specular {
  z-index: 3;
  box-shadow: inset 1px 1px 1px var(--highlight);
}

.glass-card .glass-content {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

/* Expanded state */
.glass-card.expanded {
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: none !important;
  overflow: hidden;
}

.glass-card.expanded .glass-overlay {
  background: rgba(0, 0, 0, 0.85);
}
```

## CSS: Glass Search Bar (from GlassSearchBar.css)

```css
.glass-search-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  height: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.glass-search {
  --bg-color: rgba(255, 255, 255, 0.3);
  --highlight: rgba(255, 255, 255, 0.4);
  --text: #ffffff;
  --input-bg: rgba(255, 255, 255, 0.15);
  --input-border: rgba(255, 255, 255, 0.4);
  --input-focus: rgba(255, 255, 255, 0.35);

  position: relative;
  width: 100%;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 0 25px rgba(255, 255, 255, 0.15);
  max-height: 100px;
  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-search.expanded {
  max-height: 400px;
}

.glass-filter,
.glass-overlay,
.glass-specular {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.glass-filter {
  z-index: 1;
  backdrop-filter: blur(4px);
  filter: url(#glass-distortion) saturate(120%) brightness(1.15);
}

.glass-overlay {
  z-index: 2;
  background: var(--bg-color);
}

.glass-specular {
  z-index: 3;
  box-shadow: inset 1px 1px 1px var(--highlight);
}

.glass-content {
  position: relative;
  z-index: 4;
  color: var(--text);
}

.search-input {
  width: 100%;
  padding: 15px 45px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 12px;
  color: var(--text);
  font-size: 16px;
  font-family: 'Geist Mono', monospace;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input:focus {
  outline: none;
  background: var(--input-focus);
  border-color: var(--highlight);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

/* Suggestions dropdown */
.search-suggestions {
  padding: 0 20px 20px;
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transform: translateY(-10px);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.search-suggestions.active {
  max-height: 300px;
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.suggestion-group li {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  transform: translateX(-10px);
  font-family: 'Geist Mono', monospace;
}

.search-suggestions.active .suggestion-group li {
  opacity: 1;
  transform: translateX(0);
}

.suggestion-group li:nth-child(1) { transition-delay: 0.1s; }
.suggestion-group li:nth-child(2) { transition-delay: 0.15s; }
.suggestion-group li:nth-child(3) { transition-delay: 0.2s; }

.suggestion-group li:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}
```

## Mouse-Tracking Specular Highlight (from GlassSearchBar.jsx)

```javascript
useEffect(() => {
  const currentRef = glassRef.current;
  const handleMouseMove = (e) => {
    if (!currentRef) return;
    const rect = currentRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const specular = currentRef.querySelector('.glass-specular');
    if (specular) {
      specular.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0) 60%)`;
    }
  };
  const handleMouseLeave = () => {
    const specular = currentRef?.querySelector('.glass-specular');
    if (specular) specular.style.background = 'none';
  };
  currentRef?.addEventListener('mousemove', handleMouseMove);
  currentRef?.addEventListener('mouseleave', handleMouseLeave);
  return () => {
    currentRef?.removeEventListener('mousemove', handleMouseMove);
    currentRef?.removeEventListener('mouseleave', handleMouseLeave);
  };
}, []);
```

## Design Tokens / Color Palette

```
Background:          #1B1B1B (global), #000000 (battle page)
Card bg:             rgba(0, 0, 0, 0.4)
Card bg expanded:    rgba(0, 0, 0, 0.85)
Search bar bg:       rgba(255, 255, 255, 0.3)
Input bg:            rgba(255, 255, 255, 0.15)
Highlight:           rgba(255, 255, 255, 0.25)
Border glow:         rgba(255, 70, 110, 0.4) → rgba(255, 70, 110, 0.8) on hover
Text primary:        rgba(255, 255, 255, 0.9)
Text secondary:      rgba(255, 255, 255, 0.7)
Accent pink:         #f0b0d0
Font header:         'BBH Sans Bartle', sans-serif
Font body:           'Geist Mono', monospace
```
