import React, { useCallback } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SettingRow } from '../components/SettingRow';
import { useI18n } from '../i18n';
import { useHaptics } from '../hooks/useHaptics';
import { useAppStore } from '../store/AppStore';
import type { SensitivityLevel } from '../audio/level';
import type { LanguagePreference } from '../i18n';
import type { LoudnessUnit } from '../storage/store';
import { APP_VERSION } from '../config';
import { color, radius, spacing, type } from '../theme/tokens';

type SettingsScreenProps = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { t } = useI18n();
  const { settings, updateSettings, history, clearAll } = useAppStore();
  const haptics = useHaptics();

  const handleClearHistory = useCallback(() => {
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

  return (
    <Screen scroll edges={['top', 'bottom']} tint={color.accent}>
      <View style={styles.header}>
        <IconButton name="back" onPress={onBack} accessibilityLabel={t('common.back')} />
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* -- Language --------------------------------------------------------- */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.section.language')}</Text>

        <SettingRow
          label={t('settings.section.language')}
          hint={
            settings.language === 'system'
              ? t('settings.language.systemHint')
              : undefined
          }
        >
          <SegmentedControl<LanguagePreference>
            value={settings.language}
            onChange={(language) => updateSettings({ language })}
            accessibilityLabel={t('settings.section.language')}
            options={[
              { value: 'system', label: t('settings.language.system') },
              { value: 'en', label: t('settings.language.en') },
              { value: 'zh', label: t('settings.language.zh') },
            ]}
          />
        </SettingRow>
      </Card>

      {/* -- Audio ------------------------------------------------------------ */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.section.audio')}</Text>

        <SettingRow label={t('settings.units')}>
          <SegmentedControl<LoudnessUnit>
            value={settings.units}
            onChange={(units) => updateSettings({ units })}
            accessibilityLabel={t('settings.units')}
            options={[
              { value: 'db', label: t('settings.units.db') },
              { value: 'percent', label: t('settings.units.percent') },
            ]}
          />
        </SettingRow>

        <SettingRow
          label={t('settings.sensitivity')}
          hint={t('settings.sensitivity.hint')}
        >
          <SegmentedControl<SensitivityLevel>
            value={settings.sensitivity}
            onChange={(sensitivity) => updateSettings({ sensitivity })}
            accessibilityLabel={t('settings.sensitivity')}
            options={[
              { value: 'low', label: t('settings.sensitivity.low') },
              { value: 'normal', label: t('settings.sensitivity.normal') },
              { value: 'high', label: t('settings.sensitivity.high') },
            ]}
          />
        </SettingRow>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{t('settings.haptics')}</Text>
            <Text style={styles.switchHint}>{t('settings.haptics.hint')}</Text>
          </View>
          <Switch
            value={settings.haptics}
            onValueChange={(hapticsOn) => {
              haptics.tap();
              updateSettings({ haptics: hapticsOn });
            }}
            accessibilityLabel={t('settings.haptics')}
            trackColor={{ false: color.surfaceRaised, true: color.accent }}
            thumbColor={color.text}
            ios_backgroundColor={color.surfaceRaised}
          />
        </View>
      </Card>

      {/* -- Privacy + disclaimer --------------------------------------------- */}
      <Card style={styles.section}>
        <View style={styles.infoHeader}>
          <Icon name="shield" size={18} color={color.relief} />
          <Text style={styles.sectionTitle}>{t('settings.privacy.title')}</Text>
        </View>
        <Text style={styles.infoBody}>{t('settings.privacy.body')}</Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.infoHeader}>
          <Icon name="alert" size={18} color={color.textMuted} />
          <Text style={styles.sectionTitle}>{t('settings.disclaimer.title')}</Text>
        </View>
        <Text style={styles.infoBody}>{t('settings.disclaimer.body')}</Text>
      </Card>

      {/* -- Data -------------------------------------------------------------- */}
      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>{t('settings.section.data')}</Text>
        <AppButton
          label={t('history.clearAll')}
          onPress={handleClearHistory}
          variant="secondary"
          icon="trash"
          disabled={history.length === 0}
        />
        {history.length === 0 ? (
          <Text style={styles.infoBody}>{t('history.empty.body')}</Text>
        ) : null}
      </Card>

      <Text style={styles.version}>
        {t('app.name')} · {t('settings.version')} {APP_VERSION}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerSpacer: {
    width: 48,
  },
  title: {
    ...type.heading,
    color: color.text,
  },
  section: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...type.micro,
    color: color.textMuted,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...type.label,
    color: color.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    ...type.body,
    color: color.text,
    fontWeight: '600',
  },
  switchHint: {
    ...type.caption,
    color: color.textMuted,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoBody: {
    ...type.caption,
    color: color.textMuted,
  },
  version: {
    ...type.caption,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
});
