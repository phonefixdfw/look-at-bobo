/*!
 * game/title.js — the title screen's player-only extras (issue #57).
 *
 * Three small things, all after first paint, none touching behaviour:
 *
 *   1. .bobo-mark — the inline logo's animation class hook. The capture
 *      contract takes its FIRST painted frame; the inline boot script paints
 *      the loading card synchronously, so a class added by this deferred
 *      module is provably after the first painted frame. That is the
 *      mechanism that keeps `?gate=off` byte-identical: nothing this file
 *      can affect ever lands in a captured pixel (there the gate is
 *      display:none and this file only ever toggles classes on #gate-side
 *      elements and <body>).
 *   2. calm sync — the engine knows ?motion=off / the OS reduce-motion
 *      preference; whatever shape that arrives in (a body class or a
 *      data-calm attribute), this mirrors it onto body.calm so title.css can
 *      switch the logo's blink/ear-flick/bob off with one selector. title.css
 *      also carries its own @media (prefers-reduced-motion: reduce) block,
 *      so the OS preference is covered even before this module runs.
 *   3. the how-to-play toggle: a class flip on <body> and one ARIA state.
 *      (The card's click still starts the game — the button stops
 *      propagation; the engine owns every other click on #gate.)
 */

const body = document.body;

for (const mark of document.querySelectorAll('svg.bobo')) mark.classList.add('bobo-mark');

const syncCalm = () => body.classList.toggle('calm', body.dataset.calm === 'true' || body.classList.contains('calm'));
syncCalm();
new MutationObserver(syncCalm).observe(body, { attributes: true, attributeFilter: ['data-calm', 'class'] });

const howto = document.getElementById('gate-howto');
if (howto) {
  howto.addEventListener('click', (ev) => {
    ev.stopPropagation(); // the card's click starts the game; this one just unfolds
    const open = body.classList.toggle('howto-open');
    howto.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}
