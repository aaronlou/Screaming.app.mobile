import React, { useCallback } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { StatTile } from '../components/StatTile';
import { Waveform } from '../components/Waveform';
import { useI18n } from '../i18n';
import { useHaptics } from '../hooks/useHaptics';
import { useAppStore } from '../store/AppStore';
import { formatDurationShort } from '../audio/level';
import { formatLiters } from '../stats/waste';
import { color, radius, spacing, tabularNums, thermalColor, type } from '../theme/tokens';
import { formatDayLabel, formatTimeOfDay } from '../utils/format';
import type { ScreamSession } from '../types';

type HistoryScreenProps = {
  onBack: () => void;
};

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const { t, languageTag } = useI18n();
  const { history, summary, deleteSession, clearAll } = useAppStore();
  const haptics = useHaptics();

  const handleClearAll = useCallback(() => {
    Alert.alert(t('history.clearConfirm.title'), t('history.clearConfirm.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.clearAll'),
        style: 'destructive',
        onPress: () => {
          haptics.warn();
          void clearAll();
        },
      },
    ]);
  }, [t, haptics, clearAll]);

  const renderItem = useCallback(
    ({ item }: { item: ScreamSession }) => (
      <SessionRow
        session={item}
        dayLabel={formatDayLabel(
          item.startedAt,
          languageTag,
          t('common.today'),
          t('common.yesterday'),
        )}
        timeLabel={formatTimeOfDay(item.startedAt, languageTag)}
        peakLabel={t('history.peakOf', { peak: item.metrics.peakDb })}
        deleteLabel={t('history.delete')}
        scoreLabel={t('result.score')}
        screamTimeLabel={t('result.screamTime')}
        onDelete={() => void deleteSession(item.id)}
      />
    ),
    [languageTag, t, deleteSession],
  );

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <IconButton name="back" onPress={onBack} accessibilityLabel={t('common.back')} />
        <Text style={styles.title}>{t('history.title')}</Text>
        {history.length > 0 ? (
          <IconButton
            name="trash"
            onPress={handleClearAll}
            accessibilityLabel={t('history.clearAll')}
            tint={color.textMuted}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {history.length > 0 ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <StatTile label={t('home.stat.sessions')} value={String(summary.count)} />
            <StatTile label={t('home.stat.best')} value={String(summary.bestScore)} />
            <StatTile label={t('home.stat.avgScore')} value={String(summary.averageScore)} />
          </View>
          <View style={[styles.summaryRow, styles.summaryRowSpaced]}>
            <StatTile
              label={t('home.stat.totalTime')}
              value={formatDurationShort(summary.totalScreamMs)}
            />
            <StatTile
              label={t('result.air.title')}
              value={formatLiters(summary.totalWasteAirLiters)}
              unit={t('common.litersShort')}
            />
          </View>
        </Card>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} tint={color.accent}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Icon name="clock" size={22} color={color.textMuted} />
            <Text style={styles.emptyTitle}>{t('history.empty.title')}</Text>
            <Text style={styles.emptyBody}>{t('history.empty.body')}</Text>
          </Card>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // Rows are lightweight but waveforms are not; keep the window modest.
        initialNumToRender={6}
        windowSize={5}
        removeClippedSubviews
      />
    </Screen>
  );
}

type SessionRowProps = {
  session: ScreamSession;
  dayLabel: string;
  timeLabel: string;
  peakLabel: string;
  scoreLabel: string;
  screamTimeLabel: string;
  deleteLabel: string;
  onDelete: () => void;
};

function SessionRow({
  session,
  dayLabel,
  timeLabel,
  peakLabel,
  scoreLabel,
  screamTimeLabel,
  deleteLabel,
  onDelete,
}: SessionRowProps) {
  const tint = thermalColor(session.metrics.peakLevel);

  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderText}>
          <Text style={styles.rowDate}>
            {dayLabel}
            <Text style={styles.rowTime}>{`  ${timeLabel}`}</Text>
          </Text>
          <Text style={styles.rowPeak}>{peakLabel}</Text>
        </View>

        <IconButton
          name="trash"
          size={16}
          onPress={onDelete}
          accessibilityLabel={deleteLabel}
          tint={color.textFaint}
          style={styles.rowDelete}
        />
      </View>

      <Waveform values={session.metrics.curve} height={56} tint={tint} fill={false} />

      <View style={styles.rowFooter}>
        <View style={styles.rowMetric}>
          <Text style={[styles.rowScore, tabularNums, { color: tint }]}>
            {session.metrics.score}
          </Text>
          <Text style={styles.rowMetricLabel}>{scoreLabel}</Text>
        </View>

        <View style={styles.rowMetric}>
          <Text style={[styles.rowSmall, tabularNums]}>
            {formatDurationShort(session.metrics.screamMs)}
          </Text>
          <Text style={styles.rowMetricLabel}>{screamTimeLabel}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerBlock: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 48,
  },
  title: {
    ...type.heading,
    color: color.text,
  },
  summaryCard: {
    gap: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  summaryRowSpaced: {
    marginTop: 0,
  },
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    ...type.heading,
    color: color.text,
  },
  emptyBody: {
    ...type.body,
    color: color.textMuted,
  },
  row: {
    gap: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rowHeaderText: {
    gap: 2,
    flex: 1,
  },
  rowDate: {
    ...type.label,
    color: color.text,
  },
  rowTime: {
    ...type.caption,
    color: color.textFaint,
  },
  rowPeak: {
    ...type.caption,
    color: color.textMuted,
  },
  rowDelete: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
  },
  rowFooter: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  rowMetric: {
    gap: 2,
  },
  rowScore: {
    ...type.heading,
  },
  rowSmall: {
    ...type.heading,
    color: color.text,
  },
  rowMetricLabel: {
    ...type.caption,
    color: color.textFaint,
  },
});
