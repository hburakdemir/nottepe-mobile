import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

// Web'in avatar boşluğundaki @iconify "game-icons:deer-head" fallback'ının basit
// bir RN karşılığı (o ikon seti mobilde yok) — lucide çizgi stiline uyan, elle
// çizilmiş minimal geyik başı/boynuz glifi.
export default function DeerIcon({ size = 20, color = '#6b7280' }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 8c-1.6-2-1.3-4.6-0.3-6.5" />
      <Path d="M9 8c-0.9-0.9-0.2-2.6-1.8-3.2" />
      <Path d="M15 8c1.6-2 1.3-4.6 0.3-6.5" />
      <Path d="M15 8c0.9-0.9 0.2-2.6 1.8-3.2" />
      <Path d="M8.3 11.8c-1.1-0.5-2.1-1.6-2.1-3.3" />
      <Path d="M15.7 11.8c1.1-0.5 2.1-1.6 2.1-3.3" />
      <Path d="M12 21c-2.2 0-3.8-2.3-3.8-5s1.6-4.5 3.8-4.5 3.8 1.8 3.8 4.5-1.6 5-3.8 5Z" />
      <Path d="M10.3 16.5h3.4" />
    </Svg>
  );
}
