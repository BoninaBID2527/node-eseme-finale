import { initials } from '../utils';

// Colore stabile ricavato dal nome, così la stessa persona ha sempre lo stesso avatar.
const COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#0d9488'];

export default function Avatar({ name = '?', size = 28 }) {
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="avatar" title={name} style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
