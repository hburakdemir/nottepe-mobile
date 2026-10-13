import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DAY_CHOICES } from './lostItemMeta';

interface Props {
  daysAgo: number | null;
  onDaysAgo: (v: number | null) => void;
  time: string;
  onTime: (v: string) => void;
  /** "Hatırlamıyorum" çipi; seçiliyken saat kutusu gizli. */
  allowUnknown?: boolean;
}

// Gün çipleri + "SS:DD" saat kutusu (ilan formu ve "Teslim ettim" ortak).
export default function DayTimeFields({ daysAgo, onDaysAgo, time, onTime, allowUnknown }: Props) {
  const choices: { daysAgo: number | null; label: string }[] = allowUnknown
    ? [...DAY_CHOICES, { daysAgo: null, label: 'Hatırlamıyorum' }]
    : DAY_CHOICES;

  return (
    <View>
      <View style={styles.chipWrap}>
        {choices.map((c) => {
          const active = daysAgo === c.daysAgo;
          return (
            <Pressable
              key={c.label}
              className={active ? 'bg-brand' : 'bg-inset'}
              style={styles.chip}
              onPress={() => onDaysAgo(c.daysAgo)}
            >
              <Text className={active ? '' : 'text-muted'} style={[styles.chipText, active && { color: '#fff' }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {daysAgo !== null && (
        <View style={styles.timeRow}>
          <Text className="text-muted" style={{ fontSize: 13 }}>
            Saat
          </Text>
          <TextInput
            className="text-ink border-line"
            style={styles.timeInput}
            value={time}
            onChangeText={onTime}
            maxLength={5}
            keyboardType="numbers-and-punctuation"
            placeholder="SS:DD"
            placeholderTextColor="#9ca3af"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  timeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, width: 90 },
});
