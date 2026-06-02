import { useEffect, useRef } from 'react';

const DISMISS_PX = 90;

// Drag the sheet handle downward to close (prevents mistaken pull-to-refresh on the grab bar).
export function useSheetSwipe(onClose, sheetRef) {
  const onCloseRef = useRef(onClose);
  const startY = useRef(0);
  const dragging = useRef(false);

  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const handle = sheet.querySelector('.sheet-handle');
    if (!handle) return;

    const onStart = (e) => {
      if (sheet.scrollTop > 2) return;
      startY.current = e.touches[0].clientY;
      dragging.current = true;
      sheet.classList.add('sheet-dragging');
    };

    const onMove = (e) => {
      if (!dragging.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        e.preventDefault();
        sheet.style.transform = `translateY(${dy}px)`;
      }
    };

    const onEnd = (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      sheet.classList.remove('sheet-dragging');
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy >= DISMISS_PX) {
        sheet.style.transform = '';
        sheet.classList.add('sheet-dismissing');
        const done = () => {
          sheet.classList.remove('sheet-dismissing');
          onCloseRef.current();
        };
        sheet.addEventListener('transitionend', done, { once: true });
      } else {
        sheet.style.transform = '';
      }
    };

    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd, { passive: true });
    handle.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', onStart);
      handle.removeEventListener('touchmove', onMove);
      handle.removeEventListener('touchend', onEnd);
      handle.removeEventListener('touchcancel', onEnd);
      sheet.classList.remove('sheet-dragging', 'sheet-dismissing');
      sheet.style.transform = '';
    };
  }, [sheetRef]);
}
