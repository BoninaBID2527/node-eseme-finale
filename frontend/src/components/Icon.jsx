// Set di icone a tratto (24x24) disegnate per BONTASK: nessuna libreria esterna.
const PATHS = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  tasks: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 12l3 3 5-6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  'user-plus': 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3.6-6 8-6M18 8v6M15 11h6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.5 2.2 3.5 5.2',
  logout: 'M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 8l4 4-4 4M20 12H9',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  message: 'M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  'eye-off': 'M3 3l18 18M10.6 6.2A9.5 9.5 0 0 1 12 6c5 0 8.5 4 9.5 6-.4.8-1.1 1.9-2.1 3M6.5 7.6C4.5 9 3.3 10.9 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.3 4-.9M10 10a3 3 0 0 0 4 4',
  eye: 'M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  check: 'M5 12l5 5L20 7',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  refresh: 'M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
  send: 'M21 3L3 11l7 3 3 7zM10 14L21 3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  wifi: 'M2 9c5.5-5 14.5-5 20 0M5.5 12.5c3.8-3.4 9.2-3.4 13 0M9 16c1.7-1.4 4.3-1.4 6 0M12 19.5h.01',
  'wifi-off': 'M3 3l18 18M2 9c1.6-1.5 3.4-2.5 5.3-3.1M22 9c-2-1.8-4.2-3-6.5-3.5M5.5 12.5c1-.9 2.1-1.5 3.3-1.9M18.5 12.5a9.5 9.5 0 0 0-3.8-2M9 16c1.7-1.4 4.3-1.4 6 0M12 19.5h.01',
};

export default function Icon({ name, size = 20, className = '', ...props }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
