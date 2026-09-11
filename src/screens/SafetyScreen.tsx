import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Icon, type IconName } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { useI18n, type TranslationKey } from '../i18n';
import { color, spacing, type } from '../theme/tokens';

type SafetyScreenProps = {
  onContinue: () => void;
  onBack: () => void;
};

type Check = {
  icon: IconName;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

const CHECKS: readonly Check[] = [
  { icon: 'people', titleKey: 'safety.check.people.title', bodyKey: 'safety.check.people.body' },
  { icon: 'shield', titleKey: 'safety.check.place.title', bodyKey: 'safety.check.place.body' },
  { icon: 'alert', titleKey: 'safety.check.body.title', bodyKey: 'safety.check.body.body' },
];

/**
 * The consent gate.
 *
 * This screen exists because the product's core action can genuinely harm
 * bystanders — a sudden scream near someone can frighten them, wake a baby, or
 * distract a driver. It is a deliberate one-tap friction point, not a legal
 * formality, so it stays short enough that people actually read it.
 */
export function SafetyScreen({ onContinue, onBack }: SafetyScreenProps) {
  const { t } = useI18n();

  return (
    <Screen scroll tint={color.accent}>
      <View style={styles.header}>
        <IconButton name="back" onPress={onBack} accessibilityLabel={t('common.back')} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{t('safety.title')}</Text>
        <Text style={styles.subtitle}>{t('safety.subtitle')}</Text>
      </View>

      <View style={styles.checks}>
        {CHECKS.map((check) => (
          <Card key={check.titleKey} style={styles.checkCard}>
            <View style={styles.checkIcon}>
              <Icon name={check.icon} size={20} color={color.accent} />
            </View>
            <View style={styles.checkText}>
              <Text style={styles.checkTitle}>{t(check.titleKey)}</Text>
              <Text style={styles.checkBody}>{t(check.bodyKey)}</Text>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.tip}>
        <Icon name="spark" size={16} color={color.relief} />
        <Text style={styles.tipText}>{t('safety.tip')}</Text>
      </View>

      <View style={styles.spacer} />

      <AppButton label={t('safety.ack')} onPress={onContinue} tint={color.accent} />

      <Text style={styles.legal}>{t('safety.legal')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    alignItems: 'flex-start',
  },
  intro: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...type.title,
    color: color.text,
  },
  subtitle: {
    ...type.body,
    color: color.textMuted,
  },
  checks: {
    gap: spacing.md,
  },
  checkCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  checkIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
    gap: spacing.xs,
  },
  checkTitle: {
    ...type.label,
    color: color.text,
  },
  checkBody: {
    ...type.caption,
    color: color.textMuted,
  },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  tipText: {
    ...type.caption,
    color: color.textMuted,
    flex: 1,
  },
  // Pushes the primary action toward the bottom without a hard flex:1 split, so
  // the screen still scrolls cleanly on a small phone at large text sizes.
  spacer: {
    height: spacing.xxl,
  },
  legal: {
    ...type.caption,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
