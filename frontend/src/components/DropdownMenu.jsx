import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';

// Menu a comparsa accessibile: frecce, Home/End, Esc (rimette il focus sul pulsante), chiusura cliccando fuori.
// items: [{ label, icon, onSelect, disabled, danger, checked, heading }]
export default function DropdownMenu({ label, items, align = 'right', trigger, triggerClassName = 'icon-btn', onOpenChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  const setOpenState = (value) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => !rootRef.current?.contains(e.target) && setOpenState(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) rootRef.current?.querySelector('[role^="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  const enabledItems = () => [...rootRef.current.querySelectorAll('[role^="menuitem"]:not([disabled])')];

  const onMenuKey = (e) => {
    const list = enabledItems();
    const index = list.indexOf(document.activeElement);
    const move = (i) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowUp') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpenState(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Tab') setOpenState(false);
  };

  return (
    <div className="dropdown" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpenState(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpenState(true);
          }
        }}
      >
        {trigger || <Icon name="more" size={18} />}
      </button>
      {open && (
        <div id={menuId} className={`dropdown-menu align-${align}`} role="menu" aria-label={label} onKeyDown={onMenuKey}>
          {items.map((item, i) =>
            item.heading ? (
              <div key={i} className="dropdown-heading" role="presentation">
                {item.heading}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
                aria-checked={item.checked}
                disabled={item.disabled}
                className={`dropdown-item${item.danger ? ' danger' : ''}`}
                onClick={() => {
                  setOpenState(false);
                  buttonRef.current?.focus();
                  item.onSelect();
                }}
              >
                {item.icon && <Icon name={item.icon} size={16} />}
                <span>{item.label}</span>
                {item.checked && <Icon name="check" size={16} className="dropdown-check" />}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
