import React from 'react';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { color } from '../theme/tokens';

export type IconName =
  | 'settings'
  | 'clock'
  | 'back'
  | 'close'
  | 'mic'
  | 'share'
  | 'trash'
  | 'check'
  | 'chevronRight'
  | 'shield'
  | 'alert'
  | 'wind'
  | 'people'
  | 'spark';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke width. 2 is the house default; 1.75 for dense UI. */
  strokeWidth?: number;
};

/**
 * The app's icon set.
 *
 * Hand-rolled from Lucide-style 24×24 geometry: one family, one stroke width,
 * round caps and joins throughout. Emoji are never used as structural icons —
 * they render differently on every platform and cannot be themed.
 */
export function Icon({
  name,
  size = 24,
  color: tint = color.text,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderPaths(name)}
    </Svg>
  );
}

function renderPaths(name: IconName): React.ReactNode {
  switch (name) {
    case 'settings':
      return (
        <>
          <Line x1={21} y1={4} x2={14} y2={4} />
          <Line x1={10} y1={4} x2={3} y2={4} />
          <Line x1={21} y1={12} x2={12} y2={12} />
          <Line x1={8} y1={12} x2={3} y2={12} />
          <Line x1={21} y1={20} x2={16} y2={20} />
          <Line x1={12} y1={20} x2={3} y2={20} />
          <Line x1={14} y1={2} x2={14} y2={6} />
          <Line x1={8} y1={10} x2={8} y2={14} />
          <Line x1={16} y1={18} x2={16} y2={22} />
        </>
      );

    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={10} />
          <Polyline points="12 6 12 12 16 14" />
        </>
      );

    case 'back':
      return <Path d="m15 18-6-6 6-6" />;

    case 'chevronRight':
      return <Path d="m9 18 6-6-6-6" />;

    case 'close':
      return (
        <>
          <Path d="M18 6 6 18" />
          <Path d="m6 6 12 12" />
        </>
      );

    case 'mic':
      return (
        <>
          <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <Line x1={12} y1={19} x2={12} y2={22} />
        </>
      );

    case 'share':
      return (
        <>
          <Circle cx={18} cy={5} r={3} />
          <Circle cx={6} cy={12} r={3} />
          <Circle cx={18} cy={19} r={3} />
          <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
          <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
        </>
      );

    case 'trash':
      return (
        <>
          <Path d="M3 6h18" />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <Line x1={10} y1={11} x2={10} y2={17} />
          <Line x1={14} y1={11} x2={14} y2={17} />
        </>
      );

    case 'check':
      return <Path d="M20 6 9 17l-5-5" />;

    case 'shield':
      return <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />;

    case 'alert':
      return (
        <>
          <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <Line x1={12} y1={9} x2={12} y2={13} />
          <Line x1={12} y1={17} x2={12.01} y2={17} />
        </>
      );

    case 'wind':
      return (
        <>
          <Path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <Path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <Path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </>
      );

    case 'people':
      return (
        <>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx={9} cy={7} r={4} />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );

    case 'spark':
      return (
        <>
          <Path d="M12 3v4" />
          <Path d="M12 17v4" />
          <Path d="M3 12h4" />
          <Path d="M17 12h4" />
          <Path d="m5.6 5.6 2.8 2.8" />
          <Path d="m15.6 15.6 2.8 2.8" />
          <Path d="m18.4 5.6-2.8 2.8" />
          <Path d="m8.4 15.6-2.8 2.8" />
        </>
      );

    default:
      return null;
  }
}
