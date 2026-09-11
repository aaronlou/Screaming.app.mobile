/**
 * English copy — the source of truth for the message catalogue.
 *
 * `TranslationKey` is derived from this object, and every other locale is typed
 * as `Record<TranslationKey, string>`, so forgetting to translate a key is a
 * compile error rather than a runtime "undefined" on screen.
 *
 * Voice: warm, direct, a little playful. English-first product — no idioms that
 * break when translated.
 */
export const en = {
  'app.name': 'Screaming',
  'app.tagline': 'Let it out.',

  // -- Common ---------------------------------------------------------------
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.continue': 'Continue',
  'common.retry': 'Try again',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.secondsShort': 's',
  'common.litersShort': 'L',

  // -- Home -----------------------------------------------------------------
  'home.greeting': 'Ready to let it out?',
  'home.subtitle': 'Scream as loud as you can. We measure every decibel — and never keep the audio.',
  'home.cta': 'START SCREAMING',
  'home.stat.sessions': 'Screams',
  'home.stat.best': 'Best score',
  'home.stat.totalTime': 'Total time',
  'home.stat.avgScore': 'Avg. score',
  'home.recent': 'Recent',
  'home.empty.title': 'No screams yet',
  'home.empty.body': 'Your first one is waiting. Find somewhere private and let it rip.',
  'home.history': 'History',
  'home.settings': 'Settings',
  'home.privacy': 'Audio is never saved or uploaded. Only the loudness curve stays on your device.',

  // -- Safety gate ----------------------------------------------------------
  'safety.title': 'Before you scream',
  'safety.subtitle': 'A real scream is loud. Take ten seconds to make sure it lands on nobody.',
  'safety.check.people.title': 'Look around you',
  'safety.check.people.body': 'Is anyone nearby? A sudden scream can frighten people, wake babies, or startle drivers.',
  'safety.check.place.title': 'Move somewhere private',
  'safety.check.place.body': 'A parked car, a stairwell, a bathroom, or the middle of nowhere all work well.',
  'safety.check.body.title': 'Mind your body',
  'safety.check.body.body': 'Screaming strains your throat and voice. Stop if it hurts.',
  'safety.ack': 'I am somewhere safe',
  'safety.tip': 'Tip: screaming into a pillow muffles the sound and, honestly, feels even better.',
  'safety.legal': 'Not a medical device. If you are in crisis, please contact a local helpline.',

  // -- Countdown ------------------------------------------------------------
  'countdown.title': 'Get ready',
  'countdown.breathe': 'Breathe in deep…',
  'countdown.release': 'Now. Let it all out.',

  // -- Live session ---------------------------------------------------------
  'live.status.quiet': 'Quieter than a whisper',
  'live.status.talking': 'That is talking, not screaming',
  'live.status.loud': 'Now we are getting somewhere',
  'live.status.screaming': 'THAT is a scream',
  'live.prompt.quiet': 'LOUDER',
  'live.prompt.talking': 'KEEP GOING',
  'live.prompt.loud': 'DIG DEEPER',
  'live.prompt.screaming': "DON'T STOP",
  'live.time': 'Time',
  'live.peak': 'Peak',
  'live.average': 'Average',
  'live.screamedFor': 'Screaming for',
  'live.stop': 'STOP',
  'live.stopHint': 'Tap anywhere to stop',
  'live.meter.a11y': 'Loudness {{percent}} percent, {{seconds}} seconds elapsed. {{status}}.',
  'live.permission.title': 'Microphone needed',
  'live.permission.body': 'Screaming measures how loud you are. Without the microphone there is nothing to measure.',
  'live.permission.button': 'Allow microphone',
  'live.permission.denied': 'Microphone access is off. Turn it on in Settings to keep screaming.',
  'live.permission.openSettings': 'Open Settings',
  'live.error': 'The microphone stopped responding. Give it another go.',

  // -- Results --------------------------------------------------------------
  'result.title': 'Nice one.',
  'result.subtitle': 'You got it out. Here is what it looked like.',
  'result.score': 'Scream score',
  'result.peakDb': 'Peak',
  'result.avgDb': 'Average',
  'result.screamTime': 'Time screaming',
  'result.sessionTime': 'Session length',
  'result.distribution.title': 'Where you landed',
  'result.distribution.subtitle': 'Compared with every scream recorded so far.',
  'result.distribution.you': 'YOU',
  'result.distribution.quieter': 'Quieter',
  'result.distribution.louder': 'Louder',
  'result.distribution.percentile': 'Louder than {{percent}}% of screamers',
  'result.distribution.median': 'Most people land around {{score}}',
  'result.distribution.estimateNote': 'Ranking uses a modelled baseline for now, not live user data.',
  'result.air.title': 'Stale air released',
  'result.air.value': '{{liters}} L',
  'result.air.body': 'A hard scream pushes out roughly two to four litres of air every second. That is the heavy feeling leaving your chest.',
  'result.air.equivalent': 'About {{balloons}} balloons worth.',
  'result.waveform': 'Your scream',
  'result.again': 'GO AGAIN',
  'result.share': 'Share',
  'result.shareMessage': 'I scored {{score}} on Screaming — louder than {{percent}}% of people. Peak {{peak}} dB.',
  'result.home': 'Done',
  'result.tier.1': 'Whisper',
  'result.tier.2': 'Murmur',
  'result.tier.3': 'Shout',
  'result.tier.4': 'Roar',
  'result.tier.5': 'SCREAM',
  'result.tier.6': 'EARTH-SHATTERING',

  // -- History --------------------------------------------------------------
  'history.title': 'History',
  'history.empty.title': 'Nothing here yet',
  'history.empty.body': 'Your screams will show up here, newest first.',
  'history.summary': '{{count}} screams · {{time}} total',
  'history.peakOf': 'Peak {{peak}} dB',
  'history.delete': 'Delete',
  'history.clearAll': 'Clear all history',
  'history.clearConfirm.title': 'Delete all history?',
  'history.clearConfirm.body': 'Every recorded scream will be removed from this device. This cannot be undone.',

  // -- Settings -------------------------------------------------------------
  'settings.title': 'Settings',
  'settings.section.language': 'Language',
  'settings.language.system': 'Automatic',
  'settings.language.systemHint': 'Follows your device language',
  'settings.language.en': 'English',
  'settings.language.zh': '中文',
  'settings.section.audio': 'Audio',
  'settings.units': 'Loudness unit',
  'settings.units.db': 'Decibels (dB)',
  'settings.units.percent': 'Percent of max',
  'settings.haptics': 'Haptic feedback',
  'settings.haptics.hint': 'Vibrate with the intensity of your scream',
  'settings.sensitivity': 'Microphone sensitivity',
  'settings.sensitivity.low': 'Low',
  'settings.sensitivity.normal': 'Normal',
  'settings.sensitivity.high': 'High',
  'settings.sensitivity.hint': 'Raise this if your screams never reach the top of the scale.',
  'settings.section.data': 'Your data',
  'settings.section.about': 'About',
  'settings.disclaimer.title': 'Not medical advice',
  'settings.disclaimer.body': 'Screaming is a release valve, not a treatment. It is not a substitute for care from a qualified professional. If you are struggling, please reach out to a local helpline.',
  'settings.privacy.title': 'Privacy',
  'settings.privacy.body': 'Screaming records loudness levels only. Audio is never written to disk, never uploaded, and never leaves your microphone. Measurements stay on this device.',
  'settings.version': 'Version',
  'settings.about': 'About',

  // -- Errors ---------------------------------------------------------------
  'error.title': 'Something went wrong',
  'error.storage': 'Could not read your saved screams.',
} as const;

/** Every valid translation key, derived from the English catalogue. */
export type TranslationKey = keyof typeof en;

/** Shape every locale must satisfy. Missing keys are a compile-time error. */
export type Messages = Record<TranslationKey, string>;

export const enMessages: Messages = en;
