import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { color } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

type AmbientBackgroundProps = {
  /**
   * Drives the mood. 0 = cool and still, 1 = hot and agitated.
   * Screens interpolate this themselves so the background never has to compute
   * intensity from raw audio.
   */
  intensity?: number;
  /**
   * Thermal glow colour laid over the atmosphere. Change this at band
   * boundaries rather than every frame — see the note on performance below.
   */
  tint?: string;
  children?: React.ReactNode;
};

type BlobProps = {
  id: string;
  size: number;
  tint: string;
  top: number;
  left: number;
  durationMs: number;
  travel: number;
  delayMs: number;
  /** When true the pool is drawn but never drifts. */
  still: boolean;
};

/**
 * A single pool of light.
 *
 * The soft falloff comes from an SVG radial gradient rather than a blur filter:
 * it is cheaper, renders identically on iOS and Android, and needs no
 * `filter` support from the platform.
 *
 * The drift runs on the native driver (transform only), so it keeps animating
 * smoothly even while the JS thread is busy folding microphone buffers.
 *
 * Under reduced motion the blob is still rendered — it is the app's atmosphere,
 * not an effect — but it holds still.
 */
function BlobComponent({
  id,
  size,
  tint,
  top,
  left,
  durationMs,
  travel,
  delayMs,
  still,
}: BlobProps) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      drift.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: durationMs,
          delay: delayMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, durationMs, delayMs, still]);

  const transform = [
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] }) },
    {
      translateY: drift.interpolate({
        inputRange: [0, 1],
        outputRange: [travel * 0.6, -travel * 0.4],
      }),
    },
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.14] }) },
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.blob, { width: size, height: size, top, left, transform }]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={0.18} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Memoised so the SVG gradients are not rebuilt when the parent screen
 * re-renders at meter frame rate. All blob props are stable for a given
 * viewport, so this effectively renders once per orientation change.
 */
const Blob = React.memo(BlobComponent);

/**
 * The app's atmosphere: a vertical gradient, three drifting pools of light, and
 * a thermal wash that warms as the user gets louder.
 *
 * Performance note — the blobs are deliberately static in colour. Re-rendering
 * three SVG gradients at meter frame rate would be wasteful; instead the heat is
 * carried by a single cheap overlay whose *opacity* animates on the native
 * driver while its colour changes only at band boundaries.
 */
export function AmbientBackground({
  intensity = 0,
  tint = color.accent,
  children,
}: AmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const blobs = useMemo(
    () => [
      {
        id: 'blobA',
        size: width * 1.15,
        top: -height * 0.15,
        left: -width * 0.32,
        durationMs: 11000,
        travel: width * 0.1,
        delayMs: 0,
      },
      {
        id: 'blobB',
        size: width * 0.95,
        top: height * 0.4,
        left: width * 0.32,
        durationMs: 14000,
        travel: width * 0.13,
        delayMs: 600,
      },
      {
        id: 'blobC',
        size: width * 0.8,
        top: height * 0.1,
        left: width * 0.5,
        durationMs: 9000,
        travel: width * 0.08,
        delayMs: 1200,
      },
    ],
    [width, height],
  );

  // Smoothly animate the thermal wash rather than snapping between values.
  const wash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Math.max(0, Math.min(1, intensity));

    // Under reduced motion the wash still tracks loudness — it is a readout,
    // not an effect — but it arrives instantly instead of easing.
    if (reduceMotion) {
      wash.setValue(target);
      return;
    }

    Animated.timing(wash, {
      toValue: target,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [wash, intensity, reduceMotion]);

  const washOpacity = wash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[color.bgElevated, color.bgBase, color.bgDeep]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {blobs.map((blob) => (
        <Blob
          key={blob.id}
          id={blob.id}
          size={blob.size}
          tint={color.accent}
          top={blob.top}
          left={blob.left}
          durationMs={blob.durationMs}
          travel={blob.travel}
          delayMs={blob.delayMs}
          still={reduceMotion}
        />
      ))}

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: washOpacity }]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bgDeep,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
});
