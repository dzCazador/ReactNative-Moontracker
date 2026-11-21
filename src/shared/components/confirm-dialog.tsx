import { Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { tokens } from '@/shared/theme/tokens';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmTitle: string;
  cancelTitle?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  style?: ViewStyle;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmTitle,
  cancelTitle = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
  style,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent onRequestClose={onCancel} style={[styles.backdrop, style]}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={cancelTitle}
            >
              <Text style={styles.buttonText}>{cancelTitle}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                destructive && styles.confirmDestructive,
              ]}
              onPress={onConfirm}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={confirmTitle}
            >
              <Text style={[styles.buttonText, destructive && styles.buttonTextDestructive]}>
                {confirmTitle}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  content: {
    width: '90%',
    maxWidth: 420,
    padding: tokens.spacing.sm,
  },
  card: {
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  title: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.lg,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  message: {
    color: colors.dark.textSecondary,
    fontSize: tokens.fontSize.md,
    marginBottom: tokens.spacing.lg,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
  },
  button: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  confirmButton: {
    backgroundColor: colors.dark.surfaceElevated,
  },
  confirmDestructive: {
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: colors.dark.danger,
  },
  buttonText: {
    color: colors.dark.text,
    fontSize: tokens.fontSize.md,
    fontWeight: '600',
  },
  buttonTextDestructive: {
    color: colors.dark.danger,
  },
});
