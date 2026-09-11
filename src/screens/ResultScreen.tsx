import React, { useCallback, useMemo } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { DistributionChart } from '../components/DistributionChart';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { StatTile } from '../components/StatTile';
import { Waveform } from '../components/Waveform';
import { useI18n } from '../i18n';
import { useHaptics } from '../hooks/useHaptics';
import { useAppStore } from '../store/AppStore';
import { formatDurationShort } from '../audio/level';
import { scoreTier } from '../stats/score';
import { distributionBins, medianScore, percentileForScore } from '../stats/global';
import { formatLiters, toBalloons } from '../stats/waste';
import {
  color,
  radius,
  spacing,
  tabularNums,
  thermalColor,
  type,
  withAlpha,
} from '../theme/tokens';
import { formatDecimal, formatLevel } from '../utils/format';
import type { ScreamSession } from '../types';

type ResultScreenProps = {
  session: ScreamSession;
  onAgain: () => void;
  onDone: () => void;
};

const TIER_KEYS = [
  'result.tier.1',
  'result.tier.2',
  'result.tier.3',
  'result.tier.4',
  'result.tier.5',
  'result.tier.6',
] as const;

export function ResultScreen({ session, onAgain, onDone }: ResultScreenProps) {
  const { t, languageTag } = useI18n();
  const { settings } = useAppStore();
  const haptics = useHaptics();

  const { metrics, percentile, wasteAirLiters } = session;

  // Colour the whole screen by how loud they actually got — the payoff for the
  // thermal ramp built up during the session.
  const tint = useMemo(() => thermalColor(metrics.peakLevel), [metrics.peakLevel]);

  const bins = useMemo(() => distributionBins(24), []);
  const median = useMemo(() => medianScore(), []);
  const tierKey = TIER_KEYS[scoreTier(metrics.score) - 1];

  const peak = formatLevel(metrics.peakLevel, metrics.peakDb, settings.units);
  const average = formatLevel(metrics.avgLevel, metrics.avgDb, settings.units);
  const balloons = Math.max(1, Math.round(toBalloons(wasteAirLiters)));

  const handleShare = useCallback(() => {
    haptics.tap();
    void Share.share({
      message: t('result.shareMessage', {
        score: metrics.score,
        percent: percentile,
        peak: metrics.peakDb,
      }),
    });
  }, [haptics, t, metrics.score, metrics.peakDb, percentile]);

  return (
    <Screen scroll tint={tint} intensity={0.35}>
      <View style={styles.header}>
        <IconButton name="close" onPress={onDone} accessibilityLabel={t('common.close')} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{t('result.title')}</Text>
        <Text style={styles.subtitle}>{t('result.subtitle')}</Text>
      </View>

      {/* -- Score ---------------------------------------------------------- */}
      <Card glow={tint} style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>{t('result.score')}</Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, tabularNums, { color: tint }]}>
            {metrics.score}
          </Text>
          <View style={[styles.tierPill, { backgroundColor: withAlpha(tint, 0.16) }]}>
            <Text style={[styles.tierText, { color: tint }]} numberOfLines={1}>
              {t(tierKey)}
            </Text>
          </View>
        </View>

        <Waveform values={metrics.curve} height={92} tint={tint} />

        <Text style={styles.waveformCaption}>{t('result.waveform')}</Text>
      </Card>

      {/* -- Where you landed ------------------------------------------------ */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('result.distribution.title')}</Text>
        <Text style={styles.sectionSubtitle}>{t('result.distribution.subtitle')}</Text>

        <Text style={[styles.percentile, tabularNums]}>
          {t('result.distribution.percentile', { percent: percentile })}
        </Text>

        <DistributionChart
          score={metrics.score}
          bins={bins}
          median={median}
          tint={tint}
          quieterLabel={t('result.distribution.quieter')}
          louderLabel={t('result.distribution.louder')}
          youLabel={t('result.distribution.you')}
          accessibilityLabel={`${t('result.distribution.percentile', {
            percent: percentile,
          })}. ${t('result.distribution.median', { score: median })}`}
        />

        <Text style={styles.footnote}>
          {t('result.distribution.median', { score: median })}
          {'  ·  '}
          {t('result.distribution.estimateNote')}
        </Text>
      </Card>

      {/* -- Stale air ------------------------------------------------------- */}
      <Card style={styles.section}>
        <View style={styles.airHeader}>
          <Icon name="wind" size={18} color={color.relief} />
          <Text style={styles.sectionTitle}>{t('result.air.title')}</Text>
        </View>

        <Text style={[styles.airValue, tabularNums, { color: color.relief }]}>
          {t('result.air.value', { liters: formatLiters(wasteAirLiters) })}
        </Text>

        <Text style={styles.sectionSubtitle}>{t('result.air.body')}</Text>

        <Text style={styles.footnote}>
          {t('result.air.equivalent', { balloons: formatDecimal(balloons, languageTag, 0) })}
        </Text>
      </Card>

      {/* -- Raw numbers ----------------------------------------------------- */}
      <Card style={styles.section}>
        <View style={styles.statsRow}>
          <StatTile label={t('result.peakDb')} value={peak.value} unit={peak.unit} />
          <StatTile label={t('result.avgDb')} value={average.value} unit={average.unit} />
        </View>
        <View style={[styles.statsRow, styles.statsRowSpaced]}>
          <StatTile
            label={t('result.screamTime')}
            value={formatDurationShort(metrics.screamMs)}
          />
          <StatTile
            label={t('result.sessionTime')}
            value={formatDurationShort(metrics.durationMs)}
          />
        </View>
      </Card>

      {/* -- Actions --------------------------------------------------------- */}
      <View style={styles.actions}>
        <AppButton label={t('result.again')} onPress={onAgain} tint={tint} />
        <View style={styles.actionRow}>
          <AppButton
            label={t('result.share')}
            onPress={handleShare}
            variant="secondary"
            icon="share"
            style={styles.flex}
          />
          <AppButton
            label={t('result.home')}
            onPress={onDone}
            variant="ghost"
            tint={color.textMuted}
            style={styles.flex}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    alignItems: 'flex-end',
  },
  intro: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    ...type.title,
    color: color.text,
  },
  subtitle: {
    ...type.body,
    color: color.textMuted,
  },
  scoreCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  scoreLabel: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreValue: {
    ...type.display,
    fontSize: 72,
    lineHeight: 78,
  },
  tierPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  tierText: {
    ...type.label,
    letterSpacing: 0.5,
  },
  waveformCaption: {
    ...type.caption,
    color: color.textFaint,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...type.heading,
    color: color.text,
  },
  sectionSubtitle: {
    ...type.caption,
    color: color.textMuted,
  },
  percentile: {
    ...type.title,
    color: color.text,
  },
  airHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  airValue: {
    ...type.display,
    fontSize: 52,
    lineHeight: 58,
  },
  footnote: {
    ...type.caption,
    color: color.textFaint,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statsRowSpaced: {
    marginTop: spacing.lg,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
