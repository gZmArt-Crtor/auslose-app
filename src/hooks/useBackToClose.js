import { useEffect, useRef } from 'react';

// Maps the phone/browser back button to closing a modal (history.pushState + popstate).
export function useBackToClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  const pushedRef = useRef(false);
  const closedByBackRef = useRef(false);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      closedByBackRef.current = true;
      onCloseRef.current();
    };

    history.pushState({ modal: true }, '');
    pushedRef.current = true;
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pushedRef.current && !closedByBackRef.current) {
        history.back();
      }
      pushedRef.current = false;
      closedByBackRef.current = false;
    };
  }, [isOpen]);
}
