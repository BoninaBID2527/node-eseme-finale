import { useEffect, useState } from 'react';

// Restituisce `value` solo dopo `delay` ms senza cambiamenti (per non interrogare il server ad ogni tasto).
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
