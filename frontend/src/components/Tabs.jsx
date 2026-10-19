import { useEffect, useRef } from 'react';
import Icon from './Icon';

// Tab accessibili: frecce sinistra/destra spostano la selezione (pattern WAI-ARIA "tabs").
// Ogni scheda può avere un'icona, un conteggio e, con `alert`, un conteggio evidenziato (es. nuovi messaggi).
export default function Tabs({ tabs, value, onChange, label, idPrefix = 'tab', className = '' }) {
  const listRef = useRef(null);

  // Su schermi stretti la scheda selezionata resta visibile anche se la barra scorre in orizzontale.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [value]);

  const onKeyDown = (e) => {
    const index = tabs.findIndex((t) => t.id === value);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className={`tabs ${className}`} role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${idPrefix}-${tab.id}`}
          role="tab"
          className="tab"
          aria-selected={value === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <Icon name={tab.icon} size={16} />}
          {tab.label}
          {tab.count !== undefined && tab.count !== null && (
            <span className={`tab-count${tab.alert ? ' is-alert' : ''}`} aria-label={tab.alert ? `${tab.count} nuovi` : undefined}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
