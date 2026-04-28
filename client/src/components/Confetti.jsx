import { useEffect, useState } from 'react';

const COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

export default function Confetti({ trigger = true, duration = 3000 }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    const newPieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      fallDuration: 2 + Math.random() * 2,
      fallDelay: Math.random() * 1.2,
      rotation: Math.random() * 360,
    }));
    setPieces(newPieces);
    const timer = setTimeout(() => setPieces([]), duration + 2000);
    return () => clearTimeout(timer);
  }, [trigger, duration]);

  if (!pieces.length) return null;

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            '--fall-duration': `${p.fallDuration}s`,
            '--fall-delay': `${p.fallDelay}s`,
          }}
        />
      ))}
    </div>
  );
}
