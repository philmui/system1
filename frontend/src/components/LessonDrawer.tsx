import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function LessonDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  // A citation can replace Results with a source inside the same modal. Move
  // focus with that navigation instead of leaving it on a removed button.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); if (dialog.current) dialog.current.scrollTop = 0; }, [title]);
  return <dialog ref={dialog} className="lesson-drawer" aria-labelledby="lesson-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="lesson-drawer-inner"><header><h2 ref={heading} tabIndex={-1} id="lesson-drawer-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close details"><Icon name="close" /></button></header>{children}</div>
  </dialog>;
}
