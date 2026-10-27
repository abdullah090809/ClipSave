import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

export interface SheetAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/** Android-style modal bottom sheet. Back button and scrim tap both dismiss. */
export function BottomSheetMenu({ visible, title, actions, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={onClose}
        accessibilityLabel="Close menu"
        accessibilityRole="button"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surfaceContainerHigh, paddingBottom: insets.bottom + 8 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.outline }]} />
        {title ? (
          <Text
            style={[typography.titleSmall, styles.title, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        ) : null}
        {actions.map((a) => {
          const color = a.destructive ? colors.danger : colors.textPrimary;
          return (
            <Pressable
              key={a.key}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              android_ripple={{ color: colors.ripple }}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Ionicons name={a.icon} size={22} color={color} />
              <Text style={[typography.bodyMedium, { color, marginLeft: 16 }]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginBottom: 8, opacity: 0.6 },
  title: { paddingHorizontal: 24, paddingVertical: 8 },
  item: { minHeight: 52, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
});
