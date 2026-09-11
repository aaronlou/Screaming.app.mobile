import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useHaptics } from '../hooks/useHaptics';
import { color, radius, spacing, TOUCH_TARGET, type } from '../theme/tokens';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/**
 * Pill segmented control.
 *
 * Each segment is at least 44pt tall and the selected state is carried by both
 * fill *and* text weight — not colour alone, so it survives greyscale and
 * colour-blind modes.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const haptics = useHaptics();

  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text
              style={[styles.label, selected ? styles.labelSelected : null]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: {
    backgroundColor: color.surfaceRaised,
  },
  label: {
    ...type.label,
    color: color.textMuted,
    // `alignSelf: stretch` gives the label the segment's full width rather than
    // leaving it content-sized between the segment's centred children.
    //
    // Deliberately no `adjustsFontSizeToFit`: on iOS it resolved against a zero
    // width during the first layout pass and permanently shrank the labels of
    // whichever segmented control rendered first — in practice the language
    // picker, whose labels appeared at roughly a third of the correct size
    // while the two controls below it were fine. Removing it fixes that; long
    // labels now truncate instead of shrinking.
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  labelSelected: {
    color: color.text,
    fontWeight: '700',
  },
});
