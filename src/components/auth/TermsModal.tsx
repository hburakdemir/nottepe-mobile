import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';
import { TERMS } from '../../data/termsOfUse';

// **kalın** parçalarını kalın yazar; metinde başka biçim yok.
function Rich({ text, color }: { text: string; color: string }) {
  return (
    <Text style={[styles.body, { color }]}>
      {text.split('**').map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={styles.bold}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

// Kayıt ekranındaki "Kullanım Koşulları" bağlantısının açtığı tam ekran metin.
export default function TermsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { backgroundColor: colors.ground, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.line }]}>
          <Text style={[styles.headerTitle, { color: colors.ink }]} numberOfLines={1}>
            Kullanım Koşulları
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <X size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
          <Text style={[styles.title, { color: colors.ink }]}>{TERMS.title}</Text>
          <Text style={[styles.updated, { color: colors.muted2 }]}>Son güncelleme: {TERMS.updated}</Text>
          <Rich text={TERMS.intro} color={colors.ink2} />
          {TERMS.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{section.title}</Text>
              {section.blocks.map((block, i) =>
                block.bullets ? (
                  <View key={i} style={styles.bullets}>
                    {block.bullets.map((b) => (
                      <View key={b} style={styles.bulletRow}>
                        <Text style={[styles.body, { color: colors.ink2 }]}>•</Text>
                        <View style={{ flex: 1 }}>
                          <Rich text={b} color={colors.ink2} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Rich key={i} text={block.text ?? ''} color={colors.ink2} />
                )
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  updated: { fontSize: 12, marginTop: 4, marginBottom: 14 },
  section: { marginTop: 18, gap: 6 },
  sectionTitle: { fontSize: 15.5, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  bold: { fontWeight: '700' },
  bullets: { gap: 4 },
  bulletRow: { flexDirection: 'row', gap: 8 },
});
