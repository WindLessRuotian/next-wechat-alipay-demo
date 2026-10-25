"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Native <dialog>: focus trap, Esc to close and the backdrop come from the browser. */
export function Modal({
  open,
  onClose,
  icon = "info",
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  icon?: IconName;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose}>
      <div className="row between">
        <span className="dialog-icon">
          <Icon name={icon} />
        </span>
        <button type="button" className="icon-btn" aria-label="关闭弹窗" onClick={onClose}>
          <Icon name="close" small />
        </button>
      </div>
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        {actions ?? (
          <button type="button" className="btn primary" onClick={onClose}>
            知道了
          </button>
        )}
      </div>
    </dialog>
  );
}

/** A trigger (link-style or icon button) that opens an informational dialog. */
export function InfoDialogButton({
  label,
  ariaLabel,
  className = "link-btn",
  triggerIcon,
  icon,
  title,
  children,
}: {
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
  triggerIcon?: IconName;
  icon?: IconName;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => setOpen(true)}>
        {label}
        {triggerIcon && <Icon name={triggerIcon} small={!!label} />}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} icon={icon} title={title}>
        {children}
      </Modal>
    </>
  );
}

/** Logout is a POST (see /api/auth/logout); the dialog only confirms intent. */
export function LogoutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="icon-btn" aria-label="退出登录" onClick={() => setOpen(true)}>
        <Icon name="logout" small />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon="logout"
        title="退出当前账号？"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              暂不退出
            </button>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn primary">
                确认退出
              </button>
            </form>
          </>
        }
      >
        <p>退出后会撤销当前会话，需要重新授权登录。未完成的订单仍保留在你的账号下。</p>
      </Modal>
    </>
  );
}
