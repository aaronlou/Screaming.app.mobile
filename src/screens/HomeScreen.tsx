import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { StatTile } from '../components/StatTile';
import { Waveform } from '../components/Waveform';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/AppStore';
import { color, spacing, tabularNums, type } from '../theme/tokens';
import { formatDurationShort } from '../audio/level';
import { formatDayLabel, formatTimeOfDay } from '../utils/format';

type HomeScreenProps = {
  onStart: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

export function HomeScreen({ onStart, onOpenHistory, onOpenSettings }: HomeScreenProps) {
  const { t, languageTag } = useI18n();
  const { summary } = useAppStore();

  const hasHistory = summary.count > 0;
  const last = summary.lastSession;

  return (
    <Screen scroll tint={color.accent}>
      <View style={styles.header}>
        <Text style={styles.brand}>{t('app.name')}</Text>
        <IconButton
          name="settings"
          onPress={onOpenSettings}
          accessibilityLabel={t('settings.title')}
        />
      </View>

      <View style={styles.hero}>
        <Text style={styles.greeting}>{t('home.greeting')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </View>

      <AppButton label={t('home.cta')} onPress={onStart} tint={color.accent} />

      <View style={styles.privacy}>
        <Icon name="shield" size={16} color={color.textFaint} />
        <Text style={styles.privacyText}>{t('home.privacy')}</Text>
      </View>

      {hasHistory ? (
        <>
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <StatTile
                label={t('home.stat.sessions')}
                value={String(summary.count)}
              />
              <StatTile
                label={t('home.stat.best')}
                value={String(summary.bestScore)}
              />
              <StatTile
                label={t('home.stat.totalTime')}
                value={formatDurationShort(summary.totalScreamMs)}
              />
            </View>
          </Card>

          {last ? (
            <Card style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>{t('home.recent')}</Text>
                <Text style={styles.recentMeta}>
                  {formatDayLabel(last.startedAt, languageTag, t('common.today'), t('common.yesterday'))}
                  {' · '}
                  {formatTimeOfDay(last.startedAt, languageTag)}
                </Text>
              </View>

              <Waveform values={last.metrics.curve} height={72} tint={color.accent} />

              <View style={styles.recentFooter}>
                <Text style={[styles.recentScore, tabularNums]}>
                  {last.metrics.score}
                </Text>
                <Text style={styles.recentScoreLabel}>{t('result.score')}</Text>
              </View>
            </Card>
          ) : null}

          <AppButton
            label={t('home.history')}
            variant="secondary"
            icon="clock"
            onPress={onOpenHistory}
          />
        </>
      ) : (
        <Card style={styles.emptyCard}>
          <Icon name="spark" size={22} color={color.textMuted} />
          <Text style={styles.emptyTitle}>{t('home.empty.title')}</Text>
          <Text style={styles.emptyBody}>{t('home.empty.body')}</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  brand: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  hero: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  greeting: {
    ...type.title,
    color: color.text,
  },
  subtitle: {
    ...type.body,
    color: color.textMuted,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  privacyText: {
    ...type.caption,
    color: color.textFaint,
    flex: 1,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  recentCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: {
    ...type.label,
    color: color.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recentMeta: {
    ...type.caption,
    color: color.textFaint,
  },
  recentFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  recentScore: {
    ...type.heading,
    color: color.text,
  },
  recentScoreLabel: {
    ...type.caption,
    color: color.textMuted,
  },
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xl,
  },
  emptyTitle: {
    ...type.heading,
    color: color.text,
  },
  emptyBody: {
    ...type.body,
    color: color.textMuted,
  },
});
