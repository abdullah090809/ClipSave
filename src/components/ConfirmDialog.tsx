import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { spacing, borderRadius, layout } from '../theme/spacing';
import { typography } from '../theme/typography';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap | undefined;
  iconColor?: string | undefined;
  cancelText?: string | null | undefined;
  confirmText?: string | undefined;
  confirmDestructive?: boolean | undefined;
  onCancel?: (() => void) | undefined;
  onConfirm: () => void;
}

/**
 * A theme-aware confirmation modal matching the app's Dark and Light palettes.
 * Replaces stark white native Android Alert dialogs for application-owned confirmations.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  icon,
  iconColor,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  confirmDestructive = false,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  const handleDismiss = onCancel || onConfirm;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialogContainer,
                {
                  backgroundColor: colors.surfaceContainerHigh || colors.surfaceElevated,
                  borderColor: colors.surfaceBorder,
                },
              ]}
              accessibilityRole="alert"
            >
              {/* Header with optional icon */}
              <View style={styles.headerRow}>
                {icon ? (
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: confirmDestructive
                          ? colors.dangerLight
                          : colors.primaryContainer,
                      },
                    ]}
                  >
                    <Ionicons
                      name={icon}
                      size={20}
                      color={iconColor || (confirmDestructive ? colors.danger : colors.primary)}
                    />
                  </View>
                ) : null}
                <Text
                  style={[
                    typography.titleMedium,
                    {
                      color: colors.textPrimary,
                      fontWeight: '700',
                      flex: 1,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </View>

              {/* Message */}
              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color: colors.textSecondary,
                    marginTop: spacing.sm,
                    lineHeight: 20,
                  },
                ]}
              >
                {message}
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonsRow}>
                {cancelText ? (
                  <Pressable
                    onPress={onCancel}
                    android_ripple={{ color: colors.ripple }}
                    style={[
                      styles.button,
                      styles.cancelButton,
                      {
                        backgroundColor: colors.surfaceContainer,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={cancelText}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        {
                          color: colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {cancelText}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={onConfirm}
                  android_ripple={{ color: colors.ripplePrimary }}
                  style={[
                    styles.button,
                    !cancelText ? { flex: 1 } : null,
                    {
                      backgroundColor: confirmDestructive
                        ? colors.danger
                        : colors.primary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={confirmText}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color: colors.onPrimary || '#FFFFFF',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {confirmText}
                  </Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.gutter * 1.5,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 42,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
});
