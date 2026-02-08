import { useRef, useCallback } from 'react';

interface GlassCardProps {
  className?: string;
  expanded?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GlassCard({ className = '', expanded = false, children, onClick, style }: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`glass-card ${expanded ? 'expanded' : ''} ${className}`}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      style={style}
    >
      <div className="specular" />
      <div className="glass-content">
        {children}
      </div>
    </div>
  );
}
