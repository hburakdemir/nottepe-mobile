import React, { memo } from 'react';
import { Linking, Text, type TextProps } from 'react-native';

// Metindeki http(s) adreslerini dokunulabilir bağlantıya çevirir (web'deki
// utils/linkify.jsx'in karşılığı). SSS cevaplarında rehber bağlantıları var.
const URL_RE = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;

function LinkifiedText({ children, linkClassName = 'text-accent underline', ...rest }: TextProps & { children: string; linkClassName?: string }) {
  const parts = children.split(URL_RE);
  return (
    <Text {...rest}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} className={linkClassName} onPress={() => Linking.openURL(part).catch(() => {})}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default memo(LinkifiedText);
