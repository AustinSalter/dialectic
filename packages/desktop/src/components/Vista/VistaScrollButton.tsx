/**
 * Vista Scroll Button
 *
 * Subtle button in bottom-right corner that cycles through vistas.
 * Shows current vista name on hover.
 */

import { vistaMetadata, vistaOrder } from './Vista'
import type { VistaType } from './Vista'
import styles from './VistaScrollButton.module.css'

interface VistaScrollButtonProps {
  currentVista: VistaType
  onNext: () => void
}

export function VistaScrollButton({ currentVista, onNext }: VistaScrollButtonProps) {
  const currentIndex = vistaOrder.indexOf(currentVista)
  const nextIndex = (currentIndex + 1) % vistaOrder.length
  const currentMeta = vistaMetadata[currentVista]
  const nextMeta = vistaMetadata[vistaOrder[nextIndex]]

  return (
    <button
      className={styles.button}
      onClick={onNext}
      title={`${currentMeta.name} - Click for ${nextMeta.name}`}
      aria-label={`Current vista: ${currentMeta.name}. Click to switch to ${nextMeta.name}`}
    >
      <span className={styles.label}>{currentMeta.name}</span>
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Chevron down icon */}
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.counter}>{currentIndex + 1}/{vistaOrder.length}</span>
    </button>
  )
}
