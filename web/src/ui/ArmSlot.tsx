// Reserved space for Daniel's 3D arm model (F7). Renders its children when given; until then a quiet dot field.
import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Placeholder slot for the 3D arm; pass the arm component as children once it exists. */
export default function ArmSlot({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div data-slot="arm-model" className={clsx('relative overflow-hidden rounded-[var(--radius-inner)]', className)}>
      {children ?? (
        <div
          aria-label="Arm model, sleeve not connected"
          className="absolute inset-0 grid place-items-end p-3"
          style={{ backgroundImage: 'radial-gradient(rgb(43 26 18 / 0.16) 1px, transparent 1.4px)', backgroundSize: '9px 9px' }}
        >
          <span className="eyebrow">Sleeve not connected</span>
        </div>
      )}
    </div>
  );
}
