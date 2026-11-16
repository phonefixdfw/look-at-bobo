/*!
 * game/splash.js — the title screen, as data (issue #57).
 *
 * The title screen is deliberately NOT its own scene and not even its own
 * pixels: it is `#gate` in game/full.html, re-clothed by game/title.css as a
 * modern title card (inline-SVG logo above the instructions, a START button,
 * settings + how-to-play, a dim drifting CSS backdrop — no second WebGL
 * scene). What lives HERE are the two things the shared engine needs from the
 * data, kept in one small module so #10's 3D extruded menu logo can import
 * the same component later:
 *
 *   title  — the accessible name of the mark (the SVG's <title> text), and
 *   copy   — the words, so the card's text is not smeared across files.
 *
 * `cfg.splash` being passed at all is also what turns on the engine's
 * title-screen flow: pause/win hand back to this card (backToMenu/winExit in
 * game/engine.js) instead of restarting in place, and `?gate=off` stays FULLY
 * empty of it — capture boots straight into the game, byte-identical.
 */

export const SPLASH = {
  title: 'Look at Bobo',
  copy: {
    // The instructions: the game in one joyful breath, then the one hint.
    tagline: 'a cat is doing cute things somewhere. find him, look at him, shout.',
    hint: 'not every black cat is Bobo.',
    start: 'START',
    startTouch: 'tap to start',
    howto: 'how to play',
    settings: 'settings',
    backToMenu: 'back to menu',
  },
};
