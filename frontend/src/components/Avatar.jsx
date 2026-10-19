import { initials } from '../utils';

// Colori stabili ricavati dal nome, sempre nella palette del marchio.
const TONES = [
  { bg: '#101010', fg: '#FFD600' },
  { bg: '#FFD600', fg: '#101010' },
  { bg: '#E4E4E0', fg: '#101010' },
  { bg: '#3A3A3A', fg: '#FFFFFF' },
];

export default function Avatar({ name = '?', size = 28 }) {
  const tone = TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];
  return (
    <span className="avatar" title={name} style={{ background: tone.bg, color: tone.fg, width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
