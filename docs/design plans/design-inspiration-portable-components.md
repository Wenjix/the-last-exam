# Design Inspiration: Portable Components

> Self-contained React components for Patch Battle.
> Each has minimal dependencies and can be used as-is (convert to .tsx).

---

## 1. IridescenceBackground

**Target**: `IridescenceBackground.tsx` + `.css`
**Dependencies**: React only (raw WebGL, no Three.js)
**LOC**: ~152 JSX + 9 CSS

A subtle grayscale animated WebGL shader background. Creates organic flowing patterns using iterative cosine/sine math. Very lightweight.

### Full Component (port as-is, just convert to .tsx)

```jsx
import { useEffect, useRef } from 'react';
import './IridescenceBackground.css';

function IridescenceBackground() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const uniformsRef = useRef({});
  const accumTimeRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}`;

    const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;
varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
  uv += (uMouse - vec2(0.5)) * uAmplitude;
  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  float pattern = cos(length(uv * vec2(d, a))) * 0.5 + 0.5;
  pattern = cos(pattern * 3.14159 * 2.0) * 0.5 + 0.5;
  vec3 col = vec3(pattern) * uColor;
  gl_FragColor = vec4(col, 1.0);
}`;

    function createShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const vShader = createShader(gl.VERTEX_SHADER, vertexShader);
    const fShader = createShader(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    programRef.current = program;

    const positions = new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    const uvLoc = gl.getAttribLocation(program, 'uv');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    uniformsRef.current = {
      uTime: gl.getUniformLocation(program, 'uTime'),
      uColor: gl.getUniformLocation(program, 'uColor'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uMouse: gl.getUniformLocation(program, 'uMouse'),
      uAmplitude: gl.getUniformLocation(program, 'uAmplitude'),
      uSpeed: gl.getUniformLocation(program, 'uSpeed'),
    };

    gl.uniform3f(uniformsRef.current.uColor, 0.15, 0.15, 0.15);
    gl.uniform2f(uniformsRef.current.uMouse, 0.5, 0.5);
    gl.uniform1f(uniformsRef.current.uAmplitude, 0.1);
    gl.uniform1f(uniformsRef.current.uSpeed, 0.5);

    function resize() {
      if (!canvas || !containerRef.current) return;
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uniformsRef.current.uResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    function animate(now) {
      if (!glRef.current) return;
      requestAnimationFrame(animate);
      const dt = (now - lastTimeRef.current) * 0.001;
      lastTimeRef.current = now;
      accumTimeRef.current += dt;
      gl.uniform1f(uniformsRef.current.uTime, accumTimeRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    animate(performance.now());

    return () => {
      window.removeEventListener('resize', resize);
      if (canvas && containerRef.current?.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, []);

  return <div ref={containerRef} className="iridescence-bg" />;
}

export default IridescenceBackground;
```

### CSS

```css
.iridescence-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}
```

---

## 2. DecryptedText

**Target**: `DecryptedText.tsx`
**Dependencies**: React + Framer Motion (`motion` component)
**LOC**: ~223

Scrambled text that progressively reveals itself. Supports hover/view triggers, directional reveal, and custom character sets.

### Key Props
```typescript
interface DecryptedTextProps {
  text: string;
  speed?: number;             // ms between scramble frames (default 50)
  maxIterations?: number;     // non-sequential mode iterations (default 10)
  sequential?: boolean;       // reveal one char at a time
  revealDirection?: 'start' | 'end' | 'center';
  animateOn?: 'hover' | 'view' | 'both';
  characters?: string;        // scramble character set
  className?: string;         // class for revealed chars
  encryptedClassName?: string; // class for scrambled chars
}
```

### Usage Example
```jsx
<DecryptedText text="patch battle" animateOn="view" sequential speed={50} />
```

Port to `.tsx` with type annotations on all props.

---

## 3. LogoLoop

**Target**: `LogoLoop.tsx` + `LogoLoop.css`
**Dependencies**: React only (custom hooks, no external animation lib)
**LOC**: ~289 JSX + 124 CSS

Infinite horizontal scrolling logo carousel with:
- RAF-based smooth animation (not CSS keyframes)
- ResizeObserver for responsive width
- Lazy image loading
- Pause on hover with eased deceleration
- Fade-out edge masks
- Accessible (ARIA labels, keyboard focus)

### Key Props
```typescript
interface LogoLoopProps {
  logos: Array<{ src?: string; alt?: string; node?: ReactNode; title?: string }>;
  speed?: number;           // px/s (default 120)
  direction?: 'left' | 'right';
  logoHeight?: number;      // px (default 28)
  gap?: number;             // px (default 32)
  pauseOnHover?: boolean;
  fadeOut?: boolean;         // edge fade mask
  scaleOnHover?: boolean;
}
```

### Usage Example (Patch Battle)
```jsx
import { TbBrandThreejs } from 'react-icons/tb';
import { FaReact, FaGitAlt, FaNodeJs } from 'react-icons/fa';

const logos = [
  { node: <FaGitAlt />, title: 'Git' },
  { node: <FaNodeJs />, title: 'Node.js' },
  { node: <SiTypescript />, title: 'TypeScript' },
  // ... Claude, GPT-4 logos as SVGs
];

<LogoLoop logos={logos} speed={80} direction="left" logoHeight={22} gap={40} fadeOut />
```

Port both JSX and CSS directly to `.tsx` + `.css`.

---

## 4. BattleLog (Event Stream)

**Target**: `BattleLog.tsx` + `BattleLog.css`
**Dependencies**: React only
**LOC**: ~85 JSX + 188 CSS

Read-only, color-coded event stream with auto-scroll. No text input — this is a log viewer only.

### Key Pattern: Message Rendering with Prefix Extraction
```jsx
{messages.map((msg, idx) => {
  const match = msg.text.match(/^\[([^\]]+)\]\s*(.*)/);
  const prefix = match ? match[1] : '';
  const content = match ? match[2] : msg.text;

  return (
    <div key={`${msg.timestamp}-${idx}`} className={`chat-message chat-message-${msg.type}`}>
      {prefix && <span className="chat-prefix">[{prefix}]</span>}
      {prefix && ' '}
      {content}
    </div>
  );
})}
```

### Color Coding
```css
.chat-prefix { font-weight: 700; color: rgba(255, 255, 255, 0.9); }
.chat-message-user .chat-prefix { color: #f0b0d0; }       /* pink */
.chat-message-error .chat-prefix { color: #ff6b6b; }      /* red */
.chat-message-server .chat-prefix { color: #7dd3fc; }     /* cyan */
.chat-message-agent .chat-prefix { color: #a78bfa; }      /* purple */
.chat-message-manager .chat-prefix { color: #9dc4ff; }    /* blue */
```

Message types: `system`, `patcher`, `scout`, `brute`, `architect`, `test-pass`, `test-fail`.

### Inner Glass Box Pattern
The message list itself is wrapped in a nested glass card:
```css
.chat-box {
  --bg-color: rgba(0, 0, 0, 0.5);
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  overflow: hidden;
}

/* Inner glass layers */
.chat-box .glass-filter { backdrop-filter: blur(10px); }
.chat-box .glass-overlay { background: var(--bg-color); }

.chat-content-wrapper {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  font-size: 9px;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: none; /* hide scrollbar */
}
```

---

## 5. HTML Shell (index.html)

**Target**: `index.html`
**What to keep**: SVG glass-distortion filter, font imports, viewport meta

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>patch battle</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=BBH+Sans+Bartle&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  </head>
  <body>
    <div id="root"></div>
    <svg width="0" height="0" style="position: absolute;">
      <filter id="glass-distortion">
        <feTurbulence type="turbulence" baseFrequency="0.008" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="77" />
      </filter>
    </svg>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 6. Global Styles (index.css)

```css
@import '@fontsource/geist-mono/100.css';
@import '@fontsource/geist-mono/200.css';

:root {
  background-color: #1B1B1B;
  font-family: 'Geist Mono', monospace;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #1B1B1B;
  font-family: 'Geist Mono', monospace;
  text-transform: lowercase;
}

#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #1B1B1B;
}
```

---

## Loading Dots Animation

Useful for phase indicators ("thinking...", "testing..."):

```css
.loading-dots {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}

.loading-dots span {
  color: #f0b0d0;
  font-size: 1.2em;
  animation: loadingDotFade 1.4s infinite;
  opacity: 0;
}

.loading-dots span:nth-child(1) { animation-delay: 0s; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes loadingDotFade {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}
```

## Typing Cursor Animation

```css
.typing-cursor {
  animation: blink 1s step-end infinite;
  color: #f0b0d0;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```
