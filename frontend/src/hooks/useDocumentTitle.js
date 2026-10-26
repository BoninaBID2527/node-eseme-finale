import { useEffect } from 'react';

// Imposta il titolo della scheda, utile per orientarsi e per chi usa uno screen reader.
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · BONTASK` : 'BONTASK';
  }, [title]);
}
