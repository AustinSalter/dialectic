/**
 * Vista Background Component
 *
 * Layered landscape background with:
 * - Sky gradient
 * - SVG silhouette (unique per vista)
 * - Warmth overlay (radial gradient from cabin side)
 * - Optional bear for empty state
 * - Cropping/framing effect when sidebar rails are open
 */

import styles from './Vista.module.css'

export type VistaType =
  | 'fire-lookout'
  | 'monument-valley'
  | 'big-sur'
  | 'swimming-hole'
  | 'gas-station'
  | 'trail-break'
  | 'campfire'
  | 'diner-window'
  | 'dawn'

// Vista metadata for display
export const vistaMetadata: Record<VistaType, { name: string; description: string }> = {
  'fire-lookout': { name: 'Fire Lookout', description: 'The view from the tower, endless ridges' },
  'monument-valley': { name: 'Monument Valley', description: 'Desert southwest, buttes, open road' },
  'big-sur': { name: 'Big Sur Turnout', description: 'Looking down from the pulloff' },
  'swimming-hole': { name: 'Swimming Hole', description: 'Redwood shade, cold water, curious visitor' },
  'gas-station': { name: 'Gas Station Dusk', description: 'Rural store, hazy evening, warm windows' },
  'trail-break': { name: 'Trail Break', description: 'Hilux parked, dog waiting, mountain view' },
  'campfire': { name: 'Campfire', description: 'Night, warm glow, eyes in the trees' },
  'diner-window': { name: 'Diner Window', description: 'Coffee, parking lot, unexpected guest' },
  'dawn': { name: 'Dawn', description: 'First light, mist in valleys' },
}

// Vista-specific taglines for empty states
export const vistaTaglines: Record<VistaType, string> = {
  'fire-lookout': 'The view from up here changes everything.',
  'monument-valley': 'Some distances are worth the drive.',
  'big-sur': 'Where the land meets the questions.',
  'swimming-hole': 'The cold water clears the mind.',
  'gas-station': 'Refuel before the next stretch.',
  'trail-break': "The trail doesn't think for you.",
  'campfire': 'The fire is for thinking.',
  'diner-window': 'Coffee and contradictions.',
  'dawn': 'First light on an open question.',
}

// Ordered list of vistas for cycling
export const vistaOrder: VistaType[] = [
  'fire-lookout',
  'monument-valley',
  'big-sur',
  'swimming-hole',
  'gas-station',
  'trail-break',
  'campfire',
  'diner-window',
  'dawn',
]

interface VistaProps {
  variant?: VistaType
  showBear?: boolean
  leftRailOpen?: boolean
  rightRailOpen?: boolean
}

// Map variant to CSS class name
const vistaClassMap: Record<VistaType, string> = {
  'fire-lookout': styles.vistaLookout,
  'monument-valley': styles.vistaMonumentValley,
  'big-sur': styles.vistaBigSur,
  'swimming-hole': styles.vistaSwimmingHole,
  'gas-station': styles.vistaDusk,
  'trail-break': styles.vistaTrailBreak,
  'campfire': styles.vistaCampfire,
  'diner-window': styles.vistaDinerWindow,
  'dawn': styles.vistaDawn,
}

// Fire Lookout SVG - The view from the tower, endless ridges
// Features: 3-layer tree depth with atmospheric perspective
function FireLookoutSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 140" preserveAspectRatio="none">
      <defs>
        <filter id="lookoutFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          DISTANT RIDGES - Multiple layered mountain silhouettes
          ═══════════════════════════════════════════════════════════════════ */}
      <path
        d="M0 90 L60 70 L120 80 L180 55 L240 72 L300 50 L360 65 L400 58 L400 95 L0 95 Z"
        fill="rgba(144, 176, 168, 0.5)"
      />
      <path
        d="M0 100 L80 85 L140 92 L200 75 L280 88 L340 78 L400 82 L400 105 L0 105 Z"
        fill="rgba(106, 144, 120, 0.6)"
      />

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 1 - FAR (opacity 0.35, blur)
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#lookoutFarBlur)">
        <path
          d="M0 140 L0 112 L12 110 L15 95 L18 110 L35 108 L38 92 L41 108 L58 110 L61 98 L64 110 L85 108 L88 90 L91 108 L400 110 L400 140 Z"
          fill="rgba(90, 130, 100, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 2 - MID (opacity 0.65)
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 140 L0 108 L15 106 L18 88 L21 106 L40 104 L43 85 L46 104 L68 106 L71 90 L74 106 L98 104 L101 82 L104 104 L130 106 L400 108 L400 140 Z"
          fill="rgba(74, 112, 88, 1)"
        />
        <path
          d="M300 140 L300 106 L315 104 L318 86 L321 104 L345 102 L348 82 L351 102 L378 104 L381 88 L384 104 L400 106 L400 140 Z"
          fill="rgba(74, 112, 88, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 3 - NEAR (full opacity, darkest, sharpest)
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M0 140 L0 105 L12 103 L15 82 L18 103 L38 100 L41 78 L44 100 L65 103 L68 85 L71 103 L95 100 L98 75 L101 100 L125 103 L128 85 L131 103 L158 100 L161 78 L164 100 L190 103 L193 82 L196 103 L225 100 L228 76 L231 100 L260 103 L263 85 L266 103 L295 100 L298 78 L301 100 L330 103 L333 82 L336 103 L365 100 L368 78 L371 100 L400 103 L400 140 Z"
          fill="rgba(58, 92, 70, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          LOOKOUT TOWER RAILING - Foreground framing element
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="135" width="400" height="5" fill="rgba(60, 50, 45, 0.5)" />
      <rect x="20" y="128" width="3" height="12" fill="rgba(55, 45, 40, 0.6)" />
      <rect x="60" y="128" width="3" height="12" fill="rgba(55, 45, 40, 0.6)" />
      <rect x="100" y="128" width="3" height="12" fill="rgba(55, 45, 40, 0.6)" />
      <rect x="140" y="128" width="3" height="12" fill="rgba(55, 45, 40, 0.6)" />
      <rect x="180" y="128" width="3" height="12" fill="rgba(55, 45, 40, 0.6)" />

      {/* Bear (shown in empty state) */}
      {showBear && (
        <g>
          <ellipse cx="280" cy="98" rx="10" ry="12" fill="rgba(55, 50, 45, 0.7)" />
          <circle cx="286" cy="88" r="6" fill="rgba(55, 50, 45, 0.7)" />
          <circle cx="282" cy="84" r="2.5" fill="rgba(55, 50, 45, 0.6)" />
          <circle cx="290" cy="84" r="2.5" fill="rgba(55, 50, 45, 0.6)" />
        </g>
      )}
    </svg>
  )
}

// Monument Valley SVG - Desert southwest, buttes, open road
// Features: 3-layer depth with atmospheric perspective on buttes
function MonumentValleySilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="none">
      <defs>
        <filter id="monumentFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          BUTTE LAYER 1 - FAR (opacity 0.35, blur) - Distant mesas
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#monumentFarBlur)">
        {/* Very distant mesa - far right */}
        <path
          d="M320 100 L328 100 L328 70 L332 65 L365 65 L370 70 L370 100 L380 100 L380 105 L320 105 Z"
          fill="rgba(170, 130, 100, 1)"
        />
        {/* Distant spire - far left */}
        <path
          d="M10 105 L15 105 L15 75 L18 68 L22 75 L22 105 L27 105 L27 110 L10 110 Z"
          fill="rgba(170, 130, 100, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          BUTTE LAYER 2 - MID (opacity 0.65) - Medium distance
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        {/* Merrick Butte (center back) */}
        <path
          d="M130 118 L135 118 L135 70 L140 62 L155 62 L160 70 L160 118 L165 118 L165 122 L130 122 Z"
          fill="rgba(152, 104, 72, 1)"
        />
        {/* Distant mesa - back right */}
        <path
          d="M280 105 L290 105 L290 65 L295 58 L340 58 L345 65 L345 105 L355 105 L355 110 L280 110 Z"
          fill="rgba(152, 104, 72, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          BUTTE LAYER 3 - NEAR (full opacity, darkest) - Main iconic buttes
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        {/* Left Mitten butte */}
        <path
          d="M60 125 L65 125 L65 50 L70 35 L95 35 L100 25 L105 35 L115 35 L120 50 L120 125 L125 125 L125 130 L60 130 Z"
          fill="rgba(120, 75, 48, 0.95)"
        />

        {/* Right Mitten butte */}
        <path
          d="M170 125 L175 125 L175 55 L180 42 L195 42 L200 55 L200 38 L205 30 L210 38 L210 55 L215 42 L230 42 L235 55 L235 125 L240 125 L240 130 L170 130 Z"
          fill="rgba(120, 75, 48, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          DESERT FLOOR
          ═══════════════════════════════════════════════════════════════════ */}
      <path
        d="M0 150 L0 125 Q100 122 200 125 Q300 122 400 125 L400 150 Z"
        fill="rgba(176, 136, 104, 0.6)"
      />

      {/* Road vanishing to horizon */}
      <path d="M185 150 L198 125 L202 125 L215 150 Z" fill="rgba(80, 60, 45, 0.5)" />
      {/* Road lines */}
      <line x1="200" y1="130" x2="200" y2="135" stroke="rgba(200, 180, 140, 0.3)" strokeWidth="1" strokeDasharray="2 3" />

      {/* Tiny truck on road (Hilux vibes) */}
      <rect x="194" y="138" width="12" height="6" rx="1" fill="rgba(200, 190, 170, 0.75)" />
      <rect x="195" y="135" width="5" height="4" rx="1" fill="rgba(200, 190, 170, 0.65)" />
      <circle cx="196" cy="144" r="2" fill="rgba(60, 50, 40, 0.5)" />
      <circle cx="204" cy="144" r="2" fill="rgba(60, 50, 40, 0.5)" />

      {showBear && (
        <g>
          <ellipse cx="320" cy="118" rx="10" ry="12" fill="rgba(90, 65, 45, 0.6)" />
          <circle cx="326" cy="108" r="6" fill="rgba(90, 65, 45, 0.6)" />
          <circle cx="322" cy="104" r="2.5" fill="rgba(90, 65, 45, 0.5)" />
          <circle cx="330" cy="104" r="2.5" fill="rgba(90, 65, 45, 0.5)" />
        </g>
      )}
    </svg>
  )
}

// Big Sur SVG - Coastal cliff with ocean
// Features: 3-layer depth for coastal headlands with atmospheric perspective
function BigSurSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio="none">
      <defs>
        <filter id="bigsurFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADLAND LAYER 1 - FAR (opacity 0.35, blur) - Distant foggy headlands
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#bigsurFarBlur)">
        {/* Very distant headland in fog */}
        <path
          d="M320 90 Q345 72 375 82 Q400 76 400 88 L400 100 L320 100 Z"
          fill="rgba(150, 180, 170, 1)"
        />
        {/* Another distant point */}
        <path
          d="M260 95 Q280 85 300 92 L300 100 L260 100 Z"
          fill="rgba(150, 180, 170, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADLAND LAYER 2 - MID (opacity 0.65) - Medium coastal features
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        {/* Mid-distance cliff section */}
        <path
          d="M0 160 L0 85 Q30 75 60 82 Q90 65 120 75 L120 160 Z"
          fill="rgba(100, 145, 125, 1)"
        />
        {/* Mid headland */}
        <path
          d="M230 160 L230 95 Q260 88 290 95 L290 160 Z"
          fill="rgba(100, 145, 125, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADLAND LAYER 3 - NEAR (full opacity, darkest) - Foreground cliff
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        {/* Main cliff dropping away - foreground */}
        <path
          d="M0 160 L0 65 L30 70 Q60 40 100 55 Q140 30 180 45 Q200 35 220 50 L220 160 Z"
          fill="rgba(65, 110, 90, 0.95)"
        />

        {/* Rocky outcrop detail - near foreground */}
        <path
          d="M175 160 L175 85 Q195 78 220 88 L220 160 Z"
          fill="rgba(50, 88, 72, 0.9)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          OCEAN
          ═══════════════════════════════════════════════════════════════════ */}
      <path
        d="M220 160 L220 100 Q280 95 340 100 Q380 95 400 100 L400 160 Z"
        fill="rgba(65, 110, 150, 0.5)"
      />

      {/* Wave foam suggestions */}
      <path
        d="M220 118 Q260 114 300 118 Q340 114 380 117"
        stroke="rgba(210, 220, 220, 0.25)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M240 125 Q280 122 320 125 Q360 122 400 124"
        stroke="rgba(210, 220, 220, 0.2)"
        strokeWidth="1"
        fill="none"
      />

      {/* ═══════════════════════════════════════════════════════════════════
          FOREGROUND ELEMENTS - Turnout details
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Guardrail posts (turnout hint) */}
      <rect x="5" y="60" width="2" height="14" fill="rgba(70, 60, 55, 0.6)" />
      <rect x="25" y="64" width="2" height="14" fill="rgba(70, 60, 55, 0.6)" />
      <rect x="45" y="58" width="2" height="14" fill="rgba(70, 60, 55, 0.6)" />
      {/* Guardrail cable */}
      <line x1="5" y1="65" x2="60" y2="60" stroke="rgba(70, 60, 55, 0.4)" strokeWidth="1" />

      {/* Parked car silhouette */}
      <ellipse cx="75" cy="68" rx="14" ry="6" fill="rgba(50, 48, 45, 0.6)" />
      <ellipse cx="72" cy="64" rx="6" ry="4" fill="rgba(50, 48, 45, 0.5)" />
      <circle cx="68" cy="74" r="2.5" fill="rgba(40, 38, 35, 0.5)" />
      <circle cx="82" cy="74" r="2.5" fill="rgba(40, 38, 35, 0.5)" />

      {showBear && (
        <g>
          <ellipse cx="130" cy="48" rx="8" ry="10" fill="rgba(55, 50, 48, 0.65)" />
          <circle cx="135" cy="40" r="5" fill="rgba(55, 50, 48, 0.65)" />
          <circle cx="132" cy="36" r="2" fill="rgba(55, 50, 48, 0.55)" />
          <circle cx="138" cy="36" r="2" fill="rgba(55, 50, 48, 0.55)" />
        </g>
      )}
    </svg>
  )
}

// Swimming Hole SVG - Redwoods and water
// Features: 3-layer depth for redwood trees with atmospheric perspective
function SwimmingHoleSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 180" preserveAspectRatio="none">
      <defs>
        <filter id="swimFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 1 - FAR (opacity 0.35, blur) - Distant background redwoods
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#swimFarBlur)">
        {/* Far back trees - middle */}
        <path
          d="M70 100 L75 100 L78 55 L81 100 L95 98 L98 60 L101 98 L120 100 L123 50 L126 100 L145 98 L148 58 L151 98 L170 100 Z"
          fill="rgba(75, 115, 90, 1)"
        />
        <path
          d="M230 100 L235 100 L238 58 L241 100 L260 98 L263 55 L266 98 L285 100 L288 50 L291 100 L310 98 L313 60 L316 98 L330 100 Z"
          fill="rgba(75, 115, 90, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 2 - MID (opacity 0.65) - Medium distance trees
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        {/* Mid trees - left cluster */}
        <path
          d="M50 98 L55 98 L58 48 L61 98 L78 95 L81 52 L84 95 L100 98 L103 55 L106 98 L130 95 Z"
          fill="rgba(58, 100, 75, 1)"
        />
        {/* Mid trees - right cluster */}
        <path
          d="M270 98 L275 98 L278 52 L281 98 L298 95 L301 48 L304 95 L322 98 L325 55 L328 98 L350 95 Z"
          fill="rgba(58, 100, 75, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 3 - NEAR (full opacity, darkest) - Foreground framing redwoods
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        {/* Tall redwoods framing - left side */}
        <path
          d="M0 180 L0 15 L8 15 L10 0 L12 15 L20 15 L20 180 Z"
          fill="rgba(45, 75, 55, 0.95)"
        />
        <path
          d="M22 180 L22 30 L30 30 L32 10 L34 30 L44 30 L44 180 Z"
          fill="rgba(40, 68, 50, 0.9)"
        />

        {/* Right side trees */}
        <path
          d="M380 180 L380 20 L388 20 L390 0 L392 20 L400 20 L400 180 Z"
          fill="rgba(45, 75, 55, 0.95)"
        />
        <path
          d="M356 180 L356 35 L364 35 L366 12 L368 35 L378 35 L378 180 Z"
          fill="rgba(40, 68, 50, 0.9)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          ROCKY BANKS
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Rocky bank - left */}
      <path
        d="M44 180 L44 112 Q70 105 95 112 Q110 108 125 115 L125 180 Z"
        fill="rgba(110, 100, 85, 0.55)"
      />

      {/* Rocky bank - right */}
      <path
        d="M275 180 L275 115 Q295 108 320 115 Q340 105 356 112 L356 180 Z"
        fill="rgba(110, 100, 85, 0.55)"
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SWIMMING HOLE WATER
          ═══════════════════════════════════════════════════════════════════ */}
      <ellipse cx="200" cy="148" rx="88" ry="38" fill="rgba(65, 125, 140, 0.6)" />
      <ellipse cx="200" cy="142" rx="72" ry="28" fill="rgba(80, 140, 155, 0.4)" />

      {/* Ripples */}
      <ellipse cx="175" cy="138" rx="14" ry="5" fill="none" stroke="rgba(140, 170, 180, 0.3)" strokeWidth="1" />
      <ellipse cx="225" cy="148" rx="18" ry="6" fill="none" stroke="rgba(140, 170, 180, 0.25)" strokeWidth="1" />

      {/* Someone swimming (just head) */}
      <circle cx="195" cy="135" r="4.5" fill="rgba(170, 140, 110, 0.7)" />

      {/* Bear on far bank watching! */}
      {showBear && (
        <g>
          <ellipse cx="145" cy="108" rx="10" ry="12" fill="rgba(60, 55, 48, 0.75)" />
          <circle cx="151" cy="98" r="6" fill="rgba(60, 55, 48, 0.75)" />
          <circle cx="147" cy="94" r="2.5" fill="rgba(60, 55, 48, 0.65)" />
          <circle cx="155" cy="94" r="2.5" fill="rgba(60, 55, 48, 0.65)" />
        </g>
      )}
    </svg>
  )
}

// Gas Station SVG - Rural store at dusk
// Features: 3-layer depth for distant mountains and treeline
function GasStationSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 130" preserveAspectRatio="none">
      <defs>
        <filter id="gasFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          MOUNTAIN/TREELINE LAYER 1 - FAR (opacity 0.35, blur) - Hazy mountains
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#gasFarBlur)">
        <path
          d="M0 72 L50 55 L100 62 L150 45 L200 58 L250 42 L300 55 L350 48 L400 55 L400 78 L0 78 Z"
          fill="rgba(150, 135, 105, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREELINE LAYER 2 - MID (opacity 0.65) - Background trees
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 92 L15 90 L18 78 L21 90 L40 88 L43 75 L46 88 L65 90 L68 76 L71 90 L95 88 L400 90 L400 98 L0 98 Z"
          fill="rgba(115, 98, 80, 1)"
        />
        <path
          d="M200 92 L220 90 L223 75 L226 90 L250 88 L253 72 L256 88 L280 90 L310 88 L313 74 L316 88 L340 90 L370 88 L373 76 L376 88 L400 90 L400 98 L200 98 Z"
          fill="rgba(115, 98, 80, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREELINE LAYER 3 - NEAR (full opacity, darkest) - Close treeline
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M0 95 L12 93 L15 80 L18 93 L35 91 L38 76 L41 91 L60 93 L63 78 L66 93 L400 95 L400 100 L0 100 Z"
          fill="rgba(90, 76, 62, 0.95)"
        />
        <path
          d="M240 95 L255 93 L258 78 L261 93 L280 91 L283 74 L286 91 L305 93 L330 91 L333 76 L336 91 L360 93 L363 80 L366 93 L390 91 L400 93 L400 100 L240 100 Z"
          fill="rgba(90, 76, 62, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          STATION BUILDING - Main structure
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="100" y="75" width="80" height="40" fill="rgba(62, 55, 48, 0.85)" />
      <rect x="95" y="70" width="90" height="8" fill="rgba(75, 65, 55, 0.75)" />

      {/* Windows with warm glow */}
      <rect x="110" y="85" width="15" height="12" fill="rgba(230, 190, 110, 0.65)" />
      <rect x="135" y="85" width="15" height="12" fill="rgba(230, 190, 110, 0.55)" />
      <rect x="158" y="85" width="12" height="20" fill="rgba(210, 170, 100, 0.45)" />

      {/* ═══════════════════════════════════════════════════════════════════
          GAS PUMPS AND CANOPY
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="70" y="95" width="8" height="18" fill="rgba(80, 70, 62, 0.75)" />
      <rect x="85" y="95" width="8" height="18" fill="rgba(80, 70, 62, 0.75)" />

      {/* Canopy over pumps */}
      <rect x="60" y="90" width="45" height="5" fill="rgba(70, 62, 55, 0.65)" />
      <rect x="63" y="95" width="2" height="18" fill="rgba(60, 52, 45, 0.55)" />
      <rect x="100" y="95" width="2" height="18" fill="rgba(60, 52, 45, 0.55)" />

      {/* ═══════════════════════════════════════════════════════════════════
          PICKUP TRUCK
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="200" y="105" width="35" height="12" rx="2" fill="rgba(130, 85, 65, 0.75)" />
      <rect x="202" y="100" width="12" height="7" rx="1" fill="rgba(130, 85, 65, 0.65)" />
      <circle cx="208" cy="117" r="4" fill="rgba(45, 40, 35, 0.65)" />
      <circle cx="228" cy="117" r="4" fill="rgba(45, 40, 35, 0.65)" />

      {/* ═══════════════════════════════════════════════════════════════════
          GROUND AND UTILITIES
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="115" width="400" height="15" fill="rgba(65, 58, 48, 0.55)" />

      {/* Power lines */}
      <line x1="0" y1="55" x2="400" y2="52" stroke="rgba(55, 50, 45, 0.35)" strokeWidth="1" />
      <rect x="250" y="52" width="3" height="63" fill="rgba(60, 52, 45, 0.45)" />

      {showBear && (
        <g>
          <ellipse cx="320" cy="105" rx="10" ry="12" fill="rgba(60, 55, 45, 0.6)" />
          <circle cx="326" cy="95" r="6" fill="rgba(60, 55, 45, 0.6)" />
          <circle cx="322" cy="91" r="2.5" fill="rgba(60, 55, 45, 0.5)" />
          <circle cx="330" cy="91" r="2.5" fill="rgba(60, 55, 45, 0.5)" />
        </g>
      )}
    </svg>
  )
}

// Trail Break SVG - Hilux parked, mountain view
// Features: 3-layer depth for mountains and hills with atmospheric perspective
function TrailBreakSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 140" preserveAspectRatio="none">
      <defs>
        <filter id="trailFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          MOUNTAIN LAYER 1 - FAR (opacity 0.35, blur) - Distant peaks
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#trailFarBlur)">
        <path
          d="M0 78 L80 48 L140 65 L200 38 L260 55 L320 42 L400 58 L400 85 L0 85 Z"
          fill="rgba(150, 180, 155, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          HILL LAYER 2 - MID (opacity 0.65) - Rolling foothills
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 98 Q60 88 120 95 Q180 85 240 92 Q300 82 360 90 Q380 87 400 90 L400 105 L0 105 Z"
          fill="rgba(115, 155, 115, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          MEADOW LAYER 3 - NEAR (full opacity, darkest) - Foreground grass
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M0 140 L0 102 Q100 97 200 102 Q300 95 400 100 L400 140 Z"
          fill="rgba(75, 118, 75, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TRAIL/TRACK
          ═══════════════════════════════════════════════════════════════════ */}
      <path d="M180 140 Q185 120 190 102" stroke="rgba(150, 130, 100, 0.45)" strokeWidth="8" fill="none" />
      <path d="M220 140 Q215 120 210 102" stroke="rgba(150, 130, 100, 0.45)" strokeWidth="8" fill="none" />

      {/* ═══════════════════════════════════════════════════════════════════
          HILUX TRUCK - More detailed
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="165" y="98" width="50" height="20" rx="3" fill="rgba(220, 210, 190, 0.88)" />
      <rect x="168" y="90" width="20" height="10" rx="2" fill="rgba(220, 210, 190, 0.82)" />
      {/* Truck bed */}
      <rect x="190" y="93" width="22" height="8" fill="rgba(200, 190, 175, 0.72)" />
      {/* Wheels */}
      <circle cx="178" cy="118" r="6" fill="rgba(45, 40, 35, 0.85)" />
      <circle cx="205" cy="118" r="6" fill="rgba(45, 40, 35, 0.85)" />
      {/* Windows */}
      <rect x="170" y="92" width="15" height="6" rx="1" fill="rgba(110, 130, 145, 0.55)" />

      {/* ═══════════════════════════════════════════════════════════════════
          PERSON AND DOG
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Person sitting on tailgate */}
      <ellipse cx="212" cy="96" rx="4" ry="7" fill="rgba(90, 70, 60, 0.75)" />
      <circle cx="212" cy="89" r="3.5" fill="rgba(170, 140, 120, 0.75)" />

      {/* Dog nearby */}
      <ellipse cx="242" cy="115" rx="9" ry="6" fill="rgba(170, 150, 120, 0.65)" />
      <circle cx="250" cy="110" r="3.5" fill="rgba(170, 150, 120, 0.65)" />

      {showBear && (
        <g>
          <ellipse cx="80" cy="92" rx="10" ry="12" fill="rgba(60, 55, 45, 0.6)" />
          <circle cx="86" cy="82" r="6" fill="rgba(60, 55, 45, 0.6)" />
          <circle cx="82" cy="78" r="2.5" fill="rgba(60, 55, 45, 0.5)" />
          <circle cx="90" cy="78" r="2.5" fill="rgba(60, 55, 45, 0.5)" />
        </g>
      )}
    </svg>
  )
}

// Campfire SVG - Night scene with fire
// Features: 3-layer tree depth, animated fire, stars, bear always visible
// Note: showBear prop is accepted for interface compatibility but bear is always rendered
function CampfireSilhouette({ showBear: _showBear }: { showBear: boolean }) {
  void _showBear // Silence unused warning - bear is always visible in this scene

  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none">
      {/* ═══════════════════════════════════════════════════════════════════
          STARS - Upper sky with twinkle animation
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <circle cx="45" cy="8" r="1" fill="rgba(255, 255, 255, 0.4)" className="star" />
        <circle cx="120" cy="12" r="0.8" fill="rgba(255, 255, 255, 0.35)" className="star star-delay-1" />
        <circle cx="185" cy="6" r="1.2" fill="rgba(255, 255, 255, 0.45)" className="star star-delay-2" />
        <circle cx="250" cy="10" r="0.7" fill="rgba(255, 255, 255, 0.3)" className="star star-delay-3" />
        <circle cx="310" cy="5" r="1" fill="rgba(255, 255, 255, 0.4)" className="star star-delay-4" />
        <circle cx="355" cy="14" r="0.9" fill="rgba(255, 255, 255, 0.35)" className="star star-delay-5" />
        <circle cx="80" cy="18" r="0.6" fill="rgba(255, 255, 255, 0.25)" className="star star-delay-2" />
        <circle cx="280" cy="16" r="0.8" fill="rgba(255, 255, 255, 0.3)" className="star star-delay-4" />
      </g>

      {/* Shooting star */}
      <line
        x1="320" y1="8"
        x2="325" y2="10"
        stroke="url(#shootingStarGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="shooting-star"
      />
      <defs>
        <linearGradient id="shootingStarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.8)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
        </linearGradient>
        <filter id="farBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 1 - FAR (opacity 0.35, lighter color, blur)
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#farBlur)">
        <path
          d="M-10 120 L-10 55 L5 52 L8 30 L11 52 L25 50 L28 25 L31 50 L45 52 L48 35 L51 52 L70 55 L70 120 Z"
          fill="rgba(60, 70, 55, 1)"
        />
        <path
          d="M330 120 L330 52 L345 50 L348 28 L351 50 L365 48 L368 22 L371 48 L385 50 L388 32 L391 50 L410 52 L410 120 Z"
          fill="rgba(60, 70, 55, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 2 - MID (opacity 0.65, medium color)
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 120 L0 60 L15 58 L18 35 L21 58 L40 55 L43 28 L46 55 L65 58 L68 38 L71 58 L95 55 L98 25 L101 55 L115 58 L115 120 Z"
          fill="rgba(48, 58, 45, 1)"
        />
        <path
          d="M285 120 L285 58 L300 55 L303 30 L306 55 L325 52 L328 24 L331 52 L350 55 L353 32 L356 55 L375 58 L378 35 L381 58 L400 60 L400 120 Z"
          fill="rgba(48, 58, 45, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREE LAYER 3 - NEAR (full opacity, darkest, sharpest)
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M-5 120 L-5 65 L10 62 L13 40 L16 62 L35 58 L38 32 L41 58 L60 62 L63 42 L66 62 L85 65 L85 120 Z"
          fill="rgba(35, 42, 35, 0.95)"
        />
        <path
          d="M315 120 L315 62 L330 60 L333 38 L336 60 L355 56 L358 30 L361 56 L380 60 L383 40 L386 60 L400 62 L400 120 Z"
          fill="rgba(35, 42, 35, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          GROUND
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="95" width="400" height="25" fill="rgba(42, 50, 38, 0.85)" />

      {/* Ground texture - subtle undulation */}
      <path
        d="M0 95 Q50 93 100 95 T200 94 T300 95 T400 94 L400 120 L0 120 Z"
        fill="rgba(38, 45, 35, 0.4)"
      />

      {/* ═══════════════════════════════════════════════════════════════════
          BEAR - Always visible, watching from right side trees
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        {/* Bear body */}
        <ellipse cx="340" cy="85" rx="12" ry="16" fill="rgba(50, 55, 48, 0.85)" />
        {/* Bear head */}
        <circle cx="346" cy="70" r="9" fill="rgba(50, 55, 48, 0.85)" />
        {/* Bear ears */}
        <circle cx="340" cy="64" r="3.5" fill="rgba(50, 55, 48, 0.75)" />
        <circle cx="352" cy="64" r="3.5" fill="rgba(50, 55, 48, 0.75)" />
        {/* Bear snout */}
        <ellipse cx="351" cy="72" rx="4" ry="3" fill="rgba(55, 60, 52, 0.7)" />
        {/* Bear eyes - catch firelight */}
        <circle cx="343" cy="68" r="1.5" fill="rgba(200, 150, 80, 0.5)" />
        <circle cx="349" cy="68" r="1.5" fill="rgba(200, 150, 80, 0.5)" />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          FIRE PIT ROCKS
          ═══════════════════════════════════════════════════════════════════ */}
      <ellipse cx="200" cy="105" rx="28" ry="9" fill="rgba(70, 65, 60, 0.7)" />
      <ellipse cx="200" cy="106" rx="24" ry="7" fill="rgba(60, 55, 50, 0.6)" />

      {/* ═══════════════════════════════════════════════════════════════════
          SEATED PERSON - Silhouette with proper shape
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        {/* Body - seated position */}
        <path
          d="M145 105 Q140 95 142 88 L148 75 Q150 73 152 75 L156 85 Q158 92 155 98 L160 102 Q162 104 158 106 L145 107 Z"
          fill="rgba(32, 38, 32, 0.9)"
        />
        {/* Head */}
        <circle cx="150" cy="72" r="8" fill="rgba(32, 38, 32, 0.9)" />
        {/* Arm reaching toward fire */}
        <path
          d="M152 82 Q160 85 168 88 L170 90 Q165 92 155 88 Z"
          fill="rgba(32, 38, 32, 0.85)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          FIRE - Multi-layer with animated flames
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Ember glow base */}
      <ellipse cx="200" cy="102" rx="15" ry="5" fill="rgba(180, 80, 30, 0.4)" />

      {/* Logs in fire */}
      <rect
        x="182"
        y="100"
        width="36"
        height="5"
        rx="2"
        fill="rgba(50, 40, 35, 0.8)"
        transform="rotate(-8, 200, 102)"
      />
      <rect
        x="185"
        y="98"
        width="30"
        height="5"
        rx="2"
        fill="rgba(60, 48, 40, 0.7)"
        transform="rotate(12, 200, 100)"
      />

      {/* Flame layer 1 - Outer (largest, dimmest orange) */}
      <path
        className="flame-outer"
        d="M185 102 Q182 90 186 78 Q190 65 195 72 Q200 62 205 72 Q210 65 214 78 Q218 90 215 102 Z"
        fill="rgba(200, 100, 40, 0.7)"
      />

      {/* Flame layer 2 - Mid (medium, brighter orange) */}
      <path
        className="flame-mid"
        d="M188 102 Q186 92 189 82 Q192 72 197 78 Q200 68 203 78 Q208 72 211 82 Q214 92 212 102 Z"
        fill="rgba(230, 140, 50, 0.75)"
      />

      {/* Flame layer 3 - Inner (smallest, brightest yellow) */}
      <path
        className="flame-inner"
        d="M192 102 Q191 95 193 88 Q195 80 200 85 Q205 80 207 88 Q209 95 208 102 Z"
        fill="rgba(255, 200, 80, 0.8)"
      />

      {/* Hot core */}
      <ellipse cx="200" cy="98" rx="5" ry="3" fill="rgba(255, 230, 150, 0.6)" />

      {/* ═══════════════════════════════════════════════════════════════════
          SPARKS - Rising particles with animation
          ═══════════════════════════════════════════════════════════════════ */}
      <circle cx="197" cy="75" r="1.2" fill="rgba(255, 180, 60, 0.8)" className="spark" />
      <circle cx="203" cy="72" r="1" fill="rgba(255, 160, 50, 0.7)" className="spark spark-delay-1" />
      <circle cx="200" cy="68" r="0.8" fill="rgba(255, 140, 40, 0.6)" className="spark spark-delay-2" />
      <circle cx="195" cy="70" r="0.9" fill="rgba(255, 170, 55, 0.7)" className="spark spark-delay-3" />
    </svg>
  )
}

// Diner Window SVG - View from booth
// Features: 3-layer depth for mountains and treeline viewed through window
function DinerWindowSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 145" preserveAspectRatio="none">
      <defs>
        <filter id="dinerFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          MOUNTAIN LAYER 1 - FAR (opacity 0.35, blur) - Distant mountains
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#dinerFarBlur)">
        <path
          d="M0 88 L60 65 L120 78 L180 50 L240 68 L300 52 L360 66 L400 58 L400 95 L0 95 Z"
          fill="rgba(130, 155, 140, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREELINE LAYER 2 - MID (opacity 0.65) - Background trees
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 108 L20 105 L23 92 L26 105 L50 103 L53 88 L56 103 L80 106 L83 92 L86 106 L110 103 L113 85 L116 103 L150 106 L400 108 L400 115 L0 115 Z"
          fill="rgba(100, 132, 100, 1)"
        />
        <path
          d="M200 108 L220 105 L223 90 L226 105 L250 103 L253 88 L256 103 L280 106 L310 103 L313 88 L316 103 L350 105 L353 92 L356 105 L400 108 L400 115 L200 115 Z"
          fill="rgba(100, 132, 100, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          TREELINE LAYER 3 - NEAR (full opacity, darkest) - Close trees
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M0 112 L15 110 L18 95 L21 110 L40 108 L43 92 L46 108 L70 110 L73 96 L76 110 L100 108 L103 90 L106 108 L130 110 L400 112 L400 118 L0 118 Z"
          fill="rgba(75, 105, 75, 0.95)"
        />
        <path
          d="M240 112 L260 110 L263 94 L266 110 L290 108 L293 90 L296 108 L320 110 L350 108 L353 95 L356 108 L380 110 L400 108 L400 118 L240 118 Z"
          fill="rgba(75, 105, 75, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          PARKING LOT
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="115" width="400" height="30" fill="rgba(82, 78, 70, 0.45)" />

      {/* ═══════════════════════════════════════════════════════════════════
          PARKED CARS
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="80" y="122" width="30" height="13" rx="2" fill="rgba(115, 85, 72, 0.55)" />
      <rect x="82" y="118" width="11" height="6" rx="1" fill="rgba(115, 85, 72, 0.45)" />
      <circle cx="86" cy="135" r="3" fill="rgba(45, 40, 38, 0.5)" />
      <circle cx="104" cy="135" r="3" fill="rgba(45, 40, 38, 0.5)" />

      <rect x="278" y="124" width="34" height="13" rx="2" fill="rgba(95, 105, 115, 0.55)" />
      <rect x="280" y="120" width="13" height="6" rx="1" fill="rgba(95, 105, 115, 0.45)" />
      <circle cx="286" cy="137" r="3" fill="rgba(45, 40, 38, 0.5)" />
      <circle cx="306" cy="137" r="3" fill="rgba(45, 40, 38, 0.5)" />

      {/* ═══════════════════════════════════════════════════════════════════
          WINDOW FRAME - We're looking OUT
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="0" y="0" width="15" height="145" fill="rgba(55, 48, 42, 0.35)" />
      <rect x="385" y="0" width="15" height="145" fill="rgba(55, 48, 42, 0.35)" />
      <rect x="0" y="138" width="400" height="7" fill="rgba(65, 55, 48, 0.45)" />

      {/* ═══════════════════════════════════════════════════════════════════
          COFFEE CUP ON SILL
          ═══════════════════════════════════════════════════════════════════ */}
      <rect x="350" y="126" width="13" height="15" rx="1" fill="rgba(230, 220, 205, 0.65)" />
      <ellipse cx="356" cy="126" rx="6.5" ry="2.2" fill="rgba(210, 200, 185, 0.55)" />
      {/* Coffee inside */}
      <ellipse cx="356" cy="128" rx="5" ry="1.8" fill="rgba(75, 48, 32, 0.55)" />
      {/* Cup handle */}
      <path
        d="M363 130 Q369 130 369 136 Q369 142 363 142"
        stroke="rgba(210, 200, 185, 0.55)"
        strokeWidth="2.2"
        fill="none"
      />

      {/* Bear walking across parking lot! */}
      {showBear && (
        <g>
          <ellipse cx="180" cy="128" rx="15" ry="11" fill="rgba(65, 58, 52, 0.65)" />
          <circle cx="193" cy="120" r="8" fill="rgba(65, 58, 52, 0.65)" />
          <circle cx="188" cy="115" r="3" fill="rgba(65, 58, 52, 0.55)" />
          <circle cx="198" cy="115" r="3" fill="rgba(65, 58, 52, 0.55)" />
          {/* Bear legs walking */}
          <rect x="168" y="136" width="5" height="8" rx="1" fill="rgba(65, 58, 52, 0.55)" />
          <rect x="177" y="137" width="5" height="7" rx="1" fill="rgba(65, 58, 52, 0.55)" />
          <rect x="186" y="136" width="5" height="8" rx="1" fill="rgba(65, 58, 52, 0.55)" />
        </g>
      )}
    </svg>
  )
}

// Dawn SVG - Ridge silhouette with mist
// Features: 3-layer depth for ridge silhouettes with misty atmospheric perspective
function DawnSilhouette({ showBear }: { showBear: boolean }) {
  return (
    <svg viewBox="0 0 400 110" preserveAspectRatio="none">
      <defs>
        <filter id="dawnFarBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════════════════════
          RIDGE LAYER 1 - FAR (opacity 0.35, blur) - Most distant ridge
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" filter="url(#dawnFarBlur)">
        <path
          d="M0 110 L0 72 L40 68 L80 76 L120 62 L160 72 L200 56 L240 68 L280 54 L320 64 L360 58 L400 66 L400 110 Z"
          fill="rgba(100, 120, 95, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          RIDGE LAYER 2 - MID (opacity 0.65) - Middle ridge with tree silhouette
          ═══════════════════════════════════════════════════════════════════ */}
      <g opacity="0.65">
        <path
          d="M0 110 L0 75 L20 73 L23 62 L26 73 L50 70 L53 58 L56 70 L80 73 L83 65 L86 73 L110 70 L113 56 L116 70 L150 73 L200 70 L203 58 L206 70 L240 72 L280 68 L283 55 L286 68 L320 72 L360 68 L363 58 L366 68 L400 70 L400 110 Z"
          fill="rgba(80, 98, 75, 1)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          RIDGE LAYER 3 - NEAR (full opacity, darkest) - Foreground treeline
          ═══════════════════════════════════════════════════════════════════ */}
      <g>
        <path
          d="M0 110 L0 78 L10 76 L13 65 L16 76 L30 74 L33 62 L36 74 L55 76 L58 64 L61 76 L80 73 L83 60 L86 73 L105 76 L108 66 L111 76 L130 74 L150 76 L153 62 L156 76 L180 73 L183 58 L186 73 L210 76 L230 73 L233 60 L236 73 L260 76 L280 72 L283 56 L286 72 L310 74 L330 76 L333 66 L336 76 L360 73 L363 60 L366 73 L390 76 L400 74 L400 110 Z"
          fill="rgba(55, 68, 52, 0.95)"
        />
      </g>

      {/* ═══════════════════════════════════════════════════════════════════
          MIST LAYERS - Valley fog catching first light
          ═══════════════════════════════════════════════════════════════════ */}
      <ellipse cx="90" cy="92" rx="85" ry="16" fill="rgba(200, 175, 160, 0.12)" />
      <ellipse cx="310" cy="90" rx="75" ry="14" fill="rgba(200, 175, 160, 0.10)" />
      <ellipse cx="200" cy="95" rx="60" ry="10" fill="rgba(220, 190, 170, 0.08)" />

      {showBear && (
        <g>
          <ellipse cx="200" cy="72" rx="10" ry="12" fill="rgba(48, 58, 45, 0.65)" />
          <circle cx="207" cy="62" r="6" fill="rgba(48, 58, 45, 0.65)" />
          <circle cx="203" cy="58" r="2.5" fill="rgba(48, 58, 45, 0.55)" />
          <circle cx="211" cy="58" r="2.5" fill="rgba(48, 58, 45, 0.55)" />
        </g>
      )}
    </svg>
  )
}

// SVG height mapping for each vista
const silhouetteHeights: Record<VistaType, string> = {
  'fire-lookout': '50%',
  'monument-valley': '55%',
  'big-sur': '58%',
  'swimming-hole': '65%',
  'gas-station': '48%',
  'trail-break': '50%',
  'campfire': '45%',
  'diner-window': '52%',
  'dawn': '40%',
}

export function Vista({
  variant = 'fire-lookout',
  showBear = false,
  leftRailOpen = false,
  rightRailOpen = false,
}: VistaProps) {
  const vistaClass = vistaClassMap[variant]

  // Build class list for rail states
  const railClasses = [
    leftRailOpen && styles.leftRailOpen,
    rightRailOpen && styles.rightRailOpen,
  ].filter(Boolean).join(' ')

  // Render the appropriate silhouette
  const renderSilhouette = () => {
    const height = silhouetteHeights[variant]
    const style = { height }

    switch (variant) {
      case 'fire-lookout':
        return (
          <div className={styles.silhouette} style={style}>
            <FireLookoutSilhouette showBear={showBear} />
          </div>
        )
      case 'monument-valley':
        return (
          <div className={styles.silhouette} style={style}>
            <MonumentValleySilhouette showBear={showBear} />
          </div>
        )
      case 'big-sur':
        return (
          <div className={styles.silhouette} style={style}>
            <BigSurSilhouette showBear={showBear} />
          </div>
        )
      case 'swimming-hole':
        return (
          <div className={styles.silhouette} style={style}>
            <SwimmingHoleSilhouette showBear={showBear} />
          </div>
        )
      case 'gas-station':
        return (
          <div className={styles.silhouette} style={style}>
            <GasStationSilhouette showBear={showBear} />
          </div>
        )
      case 'trail-break':
        return (
          <div className={styles.silhouette} style={style}>
            <TrailBreakSilhouette showBear={showBear} />
          </div>
        )
      case 'campfire':
        return (
          <div className={styles.silhouette} style={style}>
            <CampfireSilhouette showBear={showBear} />
          </div>
        )
      case 'diner-window':
        return (
          <div className={styles.silhouette} style={style}>
            <DinerWindowSilhouette showBear={showBear} />
          </div>
        )
      case 'dawn':
        return (
          <div className={styles.silhouette} style={style}>
            <DawnSilhouette showBear={showBear} />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`${styles.vista} ${vistaClass} ${railClasses}`}>
      <div className={styles.sky} />
      {renderSilhouette()}
      {variant === 'campfire' && <div className={styles.campfireGlow} />}
      <div className={styles.warmth} />
    </div>
  )
}
