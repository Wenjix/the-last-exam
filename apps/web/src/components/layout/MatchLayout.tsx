import { useCallback } from 'react';
import './BentoGrid.css';

interface MatchLayoutProps {
  header: React.ReactNode;
  managerCards: React.ReactNode[];
  battleLog: React.ReactNode;
  phasePanel: React.ReactNode;
  background?: React.ReactNode;
}

export function MatchLayout({ header, managerCards, battleLog, phasePanel, background }: MatchLayoutProps) {
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.setProperty('--spotlight-x', `${e.clientX}px`);
    target.style.setProperty('--spotlight-y', `${e.clientY}px`);
  }, []);

  return (
    <div className="battle-container" onMouseMove={handleMouseMove}>
      {background}
      <header className="match-header">
        {header}
      </header>
      <div className="bento-container">
        <div className="bento-grid">
          {managerCards.map((card, i) => (
            <div key={i} className="manager-slot">
              {card}
            </div>
          ))}
          <div className="battlelog-slot">
            {battleLog}
          </div>
          <div className="phase-slot">
            {phasePanel}
          </div>
        </div>
      </div>
    </div>
  );
}
