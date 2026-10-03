# Space Attack UI system

The UI follows Atomic Design from small shared decisions toward complete screens. Edit the lowest shared layer that owns a rule, then let higher layers compose it.

## Layers

- `atoms/` holds global element defaults, color, type, scale, keycaps, and button behavior. The design tokens each have one source file: `colors.css`, `typography.css`, and `scale.css`.
- `molecules/` combines atoms into score readouts, status meters, and action link variants.
- `organisms/` builds larger functional groups: the control panels, playfield objects, pause menu, wave banner, and game over summary.
- `templates/` owns responsive screen shells, columns, rails, and breakpoints shared across pages.
- `pages/` owns only screen-specific composition and placement adjustments.
- `../scripts/components/arcade-ui.js` defines the reusable custom elements that render those UI groups. Page HTML is a composition of those elements and semantic content.
- `../assets/components/atoms/icons/` stores reusable icon artwork (player, enemies, bunkers, lives, and arrow).

## Reusable elements

| Element | Main inputs | Used for |
| --- | --- | --- |
| `<arcade-button>` | `variant`, `label`, `href`, optional `wave`, `hint`, `index`, `active` | Launch, pause, and game-over actions |
| `<score-readout>` | `mode`, `label`, `zeros`, `value`, optional high-score attributes | Start, gameplay, wave, and pause score display |
| `<status-meter>` | `kind`, `value`, `max` | Hull and threat indicators |
| `<lives-indicator>` | `lives`, `total` | Life icons |
| `<control-panel>` | `mode="start"` or `mode="compact"` | Start-screen or gameplay controls |
| `<enemy-formation>` | optional `rows="type:count,..."` | Enemy formation illustration |
| `<bunker-row>` | `count` | Bunker illustration |
| `<player-ship>` | none | Player triangle illustration |
| `<wave-updates>` | `speed`, `fire-rate`, `clear-bonus` | Wave modifier list |
| `<countdown-timer>` | `seconds`, `wave` | New-wave countdown |
| `<run-summary>` | `final-score`, `waves-cleared`, `hi-score` | Game-over stats |
| `<arcade-title>` | `variant="start"` or `variant="game-over"` | Large display title composition |
| `<hostile-readout>` | `count`, `total` | Remaining hostile count |

Shared appearance belongs in the component layer; page CSS should only handle a screen's unique arrangement. When adding a UI pattern, first reuse an existing element, then add or extend an atom, molecule, or organism before adding page-specific CSS.
