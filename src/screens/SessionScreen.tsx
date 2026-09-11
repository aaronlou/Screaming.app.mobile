import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { LevelMeter } from '../components/LevelMeter';
import { Screen } from '../components/Screen';
import { StatTile } from '../components/StatTile';
import { Waveform } from '../components/Waveform';
import { useI18n, type TranslationKey } from '../i18n';
import { useAppStore } from '../store/AppStore';
import {
  MAX_SESSION_MS,
  useScreamSession,
  type SessionPhase,
} from '../audio/useScreamSession';
import { classifyLevel, formatDurationShort, type LoudnessBand } from '../audio/level';
import { color, radius, spacing, tabularNums, thermalColor, type } from '../theme/tokens';
import { formatLevel } from '../utils/format';
import type { ScreamMetrics } from '../types';

type SessionScreenProps = {
  onFinish: (metrics: ScreamMetrics) => void;
  onCancel: () => void;
};

const STATUS_KEY: Record<LoudnessBand, TranslationKey> = {
  quiet: 'live.status.quiet',
  talking: 'live.status.talking',
  loud: 'live.status.loud',
  screaming: 'live.status.screaming',
};

const PROMPT_KEY: Record<LoudnessBand, TranslationKey> = {
  quiet: 'live.prompt.quiet',
  talking: 'live.prompt.talking',
  loud: 'live.prompt.loud',
  screaming: 'live.prompt.screaming',
};

/** Ignore taps for this long after the live phase starts. */
const STOP_GRACE_MS = 1000;

export function SessionScreen({ onFinish, onCancel }: SessionScreenProps) {
  const { t } = useI18n();
  const { settings } = useAppStore();

  const {
    phase,
    countdown,
    live,
    metrics,
    canAskAgain,
    start,
    requestPermission,
    openSettings,
    stop,
  } = useScreamSession({
    sensitivity: settings.sensitivity,
    hapticsEnabled: settings.haptics,
  });

  // -- Auto-start -----------------------------------------------------------
  // The safety screen already captured consent, so arriving here with
  // permission granted should flow straight into the countdown. Any extra tap
  // would be a chance for the user to lose their nerve.
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (phase === 'ready' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      start();
    }
  }, [phase, start]);

  // -- Hand the result back exactly once ------------------------------------
  const reportedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'finished' || !metrics || reportedRef.current) return;
    reportedRef.current = true;
    onFinish(metrics);
  }, [phase, metrics, onFinish]);

  const backdropIntensity = useMemo(() => Math.round(live.level * 4) / 4, [live.level]);
  const tint = useMemo(() => thermalColor(backdropIntensity), [backdropIntensity]);

  const handleStop = useCallback(() => stop(), [stop]);

  const canTapToStop = phase === 'live' && live.elapsedMs > STOP_GRACE_MS;

  return (
    <Screen tint={tint} intensity={backdropIntensity} edges={['top', 'bottom']}>
      {/*
        Full-screen tap target: while screaming, hunting for a button is the
        last thing anyone wants to do.

        Deliberately given no accessibility role. An earlier version exposed
        this as a `button`, which on web produced invalid nested `<button>`
        markup and on native would have nested one accessible control inside
        another. This is a convenience shortcut for sighted users; the STOP
        button below is the real, announced control.
      */}
      <Pressable
        style={styles.root}
        onPress={canTapToStop ? handleStop : undefined}
        disabled={!canTapToStop}
        accessible={false}
      >
        {renderPhase()}
      </Pressable>
    </Screen>
  );

  function renderPhase() {
    switch (phase) {
      case 'checking':
        return <View style={styles.centered} />;

      case 'needsPermission':
        return (
          <View style={styles.centered}>
            <Card style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Icon name="mic" size={26} color={color.accent} />
              </View>
              <Text style={styles.permissionTitle}>{t('live.permission.title')}</Text>
              <Text style={styles.permissionBody}>
                {canAskAgain ? t('live.permission.body') : t('live.permission.denied')}
              </Text>
              <AppButton
                label={
                  canAskAgain ? t('live.permission.button') : t('live.permission.openSettings')
                }
                onPress={canAskAgain ? () => void requestPermission() : openSettings}
                tint={color.accent}
              />
              <AppButton
                label={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={onCancel}
              />
            </Card>
          </View>
        );

      case 'countdown':
        return (
          <View style={styles.centered}>
            <Text style={styles.countdownTitle}>{t('countdown.title')}</Text>
            <CountdownNumber value={countdown} />
            <Text style={styles.countdownHint}>{t('countdown.breathe')}</Text>
          </View>
        );

      case 'live':
        // Called as a plain function, not rendered as <LivePhase />. A nested
        // component declaration would be a brand-new component type on every
        // render, so React would unmount and remount the entire meter subtree
        // 20 times a second.
        return renderLive();

      case 'error':
        return (
          <View style={styles.centered}>
            <Card style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Icon name="alert" size={26} color={color.danger} />
              </View>
              <Text style={styles.permissionTitle}>{t('error.title')}</Text>
              <Text style={styles.permissionBody}>{t('live.error')}</Text>
              <AppButton label={t('common.back')} onPress={onCancel} tint={color.accent} />
            </Card>
          </View>
        );

      case 'finished':
        // The parent swaps in the results screen on the very next frame.
        return <View style={styles.centered} />;

      case 'ready':
      default:
        return <View style={styles.centered} />;
    }
  }

  function renderLive() {
    const band = classifyLevel(live.level);
    const seconds = (live.elapsedMs / 1000).toFixed(1);
    const peak = formatLevel(live.peakLevel, live.peakDb, settings.units);
    const average = formatLevel(live.avgLevel, live.avgDb, settings.units);
    const timeProgress = Math.min(1, live.elapsedMs / MAX_SESSION_MS);

    return (
      <View style={styles.liveRoot}>
        <View style={styles.liveHeader}>
          <Text style={styles.liveStatus}>{t(STATUS_KEY[band])}</Text>
        </View>

        <View style={styles.livePromptWrap}>
          <Text style={[styles.livePrompt, { color: tint }]} numberOfLines={1}>
            {t(PROMPT_KEY[band])}
          </Text>
        </View>

        <View style={styles.meterWrap}>
          <LevelMeter
            level={live.level}
            size={280}
            centerValue={seconds}
            centerCaption={t('live.time')}
            accessibilityLabel={t('live.meter.a11y', {
              percent: Math.round(live.level * 100),
              seconds,
              status: t(STATUS_KEY[band]),
            })}
          />
        </View>

        <Waveform values={live.recent} height={64} tint={tint} />

        <Card style={styles.liveStats}>
          <View style={styles.statsRow}>
            <StatTile label={t('live.peak')} value={peak.value} unit={peak.unit} />
            <StatTile label={t('live.average')} value={average.value} unit={average.unit} />
            <StatTile
              label={t('live.screamedFor')}
              value={formatDurationShort(live.screamMs)}
            />
          </View>
        </Card>

        <View style={styles.liveFooter}>
          {/* Safety cap: a visual countdown to the automatic stop so the end
              never arrives as a surprise. */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${timeProgress * 100}%`, backgroundColor: tint },
              ]}
            />
          </View>

          <Text style={styles.stopHint}>{t('live.stopHint')}</Text>

          <AppButton
            label={t('live.stop')}
            onPress={handleStop}
            variant="secondary"
            tint={color.text}
            accessibilityHint={t('live.stopHint')}
          />
        </View>
      </View>
    );
  }
}

/**
 * The countdown digit.
 *
 * Re-animates on every change rather than morphing between digits: the pop is
 * what makes the beat feel intentional. Uses `Easing.back` for a slight
 * overshoot, which reads as energy rather than bounce.
 */
function CountdownNumber({ value }: { value: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  // Captured once so the parallel-object animation below stays stable.
  const scale = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
    [progress],
  );

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.back(1.8)),
      useNativeDriver: true,
    }).start();
  }, [value, progress]);

  return (
    <Animated.Text style={[styles.countdownNumber, { opacity: progress, transform: [{ scale }] }]}>
      {String(Math.max(1, value))}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // -- Permission / error ---------------------------------------------------
  permissionCard: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    ...type.heading,
    color: color.text,
    textAlign: 'center',
  },
  permissionBody: {
    ...type.body,
    color: color.textMuted,
    textAlign: 'center',
  },
  // -- Countdown ------------------------------------------------------------
  countdownTitle: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  countdownNumber: {
    ...type.display,
    fontSize: 140,
    lineHeight: 160,
    color: color.text,
  },
  countdownHint: {
    ...type.body,
    color: color.textMuted,
  },
  // -- Live -----------------------------------------------------------------
  liveRoot: {
    flex: 1,
    gap: spacing.lg,
  },
  liveHeader: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  liveStatus: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  livePromptWrap: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  livePrompt: {
    ...type.heading,
    fontSize: 26,
    letterSpacing: 1.5,
  },
  meterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  liveStats: {
    paddingVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  liveFooter: {
    gap: spacing.md,
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: color.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stopHint: {
    ...type.caption,
    color: color.textFaint,
  },
});
