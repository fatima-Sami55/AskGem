import React, { useEffect } from 'react';
import InteractiveMascot from './InteractiveMascot';
import { useMascot } from '../../context/MascotContext';
import './InteractiveMascot.css';

/**
 * MascotLoader — reusable full-screen loading overlay.
 * Uses the same Peri + dot animation already in use on the auth redirect screen.
 *
 * Props:
 *   message {string}  Optional label below the dots. Defaults to 'Loading...'.
 *   size    {number}  Mascot size in px. Defaults to 160.
 */
export default function MascotLoader({ message = 'Loading...', size = 160 }) {
  const { setAction, clearSpeech } = useMascot();

  useEffect(() => {
    setAction('thinking');
    return () => {
      setAction('idle');
      clearSpeech();
    };
  }, [setAction, clearSpeech]);

  return (
    <div className="mascot-loader-overlay">
      <InteractiveMascot size={size} interactive={false} />

      {/* Four-dot spinner using the palette */}
      <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
        {['#39B1D1', '#D6FB61', '#F6850C', '#DE3E3E'].map((color, i) => (
          <span
            key={color}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>

      {message && (
        <p className="mascot-loader-label">{message}</p>
      )}
    </div>
  );
}
