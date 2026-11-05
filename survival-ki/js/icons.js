/* Survival-KI Studio – Symbole (eigene, einfache Linien-Icons, 24×24) */
var SK = (globalThis.SK = globalThis.SK || {});

SK.icons = (function () {
  var P = {
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    radiation: '<circle cx="12" cy="12" r="1.6"/><path d="M10.4 9.23 7.5 4.21A9 9 0 0 1 16.5 4.21L13.6 9.23A3.2 3.2 0 0 0 10.4 9.23Z"/><path d="M15.2 12H21A9 9 0 0 1 16.5 19.79L13.6 14.77A3.2 3.2 0 0 0 15.2 12Z"/><path d="M10.4 14.77 7.5 19.79A9 9 0 0 1 3 12H8.8A3.2 3.2 0 0 0 10.4 14.77Z"/>',
    shield: '<path d="M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    flame: '<path d="M12 22c3.9 0 6.5-2.6 6.5-6.3 0-3.4-2.3-5.6-4-7.7-.9 1.8-2 2.6-3 2.8.5-3.2-.6-6.3-3.2-8.3.2 3.4-1.5 5.6-3 7.6-1.1 1.5-1.8 3.3-1.8 5.6C3.5 19.4 7.1 22 12 22Z"/>',
    drop: '<path d="M12 3s-6.5 7.2-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3Z"/>',
    radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m7 8 10-4"/><circle cx="15.5" cy="14" r="2.5"/><path d="M6.5 12h4M6.5 15h4"/>',
    tent: '<path d="M3 20 12 4l9 16H3Z"/><path d="M12 4v16M9 20l3-5 3 5"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    train: '<path d="M4 18h16"/><path d="M6 18V9M10 18V5M14 18v-7M18 18V8"/>',
    chat: '<path d="M4 5.5h16v10H9l-5 4v-14Z"/><path d="M8 9.5h8M8 12.5h5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.8"/><path d="m5.6 5.6 3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 15v4.5h15V15"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 15v4.5h15V15"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V4h-11.5v11.5h4.5"/>',
    play: '<path d="M7 4.5v15L19.5 12 7 4.5Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M7 11v9H4v-9h3Z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7"/>',
    down: '<path d="M7 13V4H4v9h3Z"/><path d="M7 13l4 7c1.5 0 2.5-1 2.5-2.5V14h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 17.3 4H7"/>',
    sparkles: '<path d="M10 3.5 11.7 8 16 9.7l-4.3 1.7L10 16l-1.7-4.6L4 9.7 8.3 8 10 3.5Z"/><path d="M17.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    offline: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.6M12 9.5a10 10 0 0 1 7 3.5M2 9.5a15 15 0 0 1 4.5-3M10.5 5.1A15 15 0 0 1 22 9.5"/><circle cx="12" cy="20" r="1"/>',
    alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    save: '<path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L20 9.5"/><path d="M20 4v5.5h-5.5"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.7A3.7 3.7 0 0 1 17.5 18.5H7Z"/>',
    laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19l-2-4h-15l-2 4Z"/>',
    browser: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18M6.5 6.8h.01M9 6.8h.01"/>',
    star: '<path d="m12 3.5 2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.8l-5.4 2.9 1.2-5.9L3.4 9.7l6-.7L12 3.5Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    send: '<path d="M4 12 20 4l-4 16-4-6.5L4 12Z"/><path d="m12 13.5 8-9.5"/>',
    install: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M12 7v7M9.5 11.5 12 14l2.5-2.5M10.5 18.5h3"/>',
  };
  var MODE_ICON = { blackout: 'bolt', survival: 'compass', apokalypse: 'radiation' };
  return {
    names: Object.keys(P),
    get: function (name, cls) {
      return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || P.star) + '</svg>';
    },
    mode: function (id) { return MODE_ICON[id] || 'star'; },
    MODEL_ICONS: ['shield', 'bolt', 'compass', 'radiation', 'flame', 'drop', 'radio', 'tent'],
  };
})();
