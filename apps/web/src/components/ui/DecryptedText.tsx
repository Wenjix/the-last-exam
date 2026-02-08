import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  sequential?: boolean;
  animateOn?: 'view' | 'hover' | 'both';
  className?: string;
}

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export function DecryptedText({
  text,
  speed = 50,
  sequential = true,
  animateOn = 'view',
  className = '',
}: DecryptedTextProps) {
  const [displayed, setDisplayed] = useState<string[]>(() => text.split('').map(() => randomChar()));
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const controls = useAnimation();

  const startReveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);

    const chars = text.split('');
    if (sequential) {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= chars.length) {
          clearInterval(interval);
          return;
        }
        setDisplayed((prev) => {
          const next = [...prev];
          // Scramble upcoming chars
          for (let j = i + 1; j < chars.length; j++) {
            next[j] = randomChar();
          }
          next[i] = chars[i];
          return next;
        });
        i++;
      }, speed);
    } else {
      // Reveal all at once with scramble
      let iterations = 0;
      const maxIterations = 8;
      const interval = setInterval(() => {
        if (iterations >= maxIterations) {
          setDisplayed(chars);
          clearInterval(interval);
          return;
        }
        setDisplayed(chars.map((c, idx) => {
          const revealThreshold = (idx / chars.length) * maxIterations;
          return iterations >= revealThreshold ? c : randomChar();
        }));
        iterations++;
      }, speed);
    }
  }, [text, speed, sequential, revealed]);

  // View-triggered reveal
  useEffect(() => {
    if (animateOn === 'hover') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startReveal();
      },
      { threshold: 0.5 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [animateOn, startReveal]);

  // Hover-triggered reveal
  const handleMouseEnter = () => {
    if (animateOn === 'hover' || animateOn === 'both') {
      setHovered(true);
      startReveal();
    }
  };

  return (
    <span
      ref={containerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      style={{ display: 'inline-block' }}
    >
      {displayed.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: char === text[i] ? 1 : 0.5 }}
          transition={{ duration: 0.1 }}
          style={{
            display: 'inline-block',
            whiteSpace: char === ' ' ? 'pre' : undefined,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
