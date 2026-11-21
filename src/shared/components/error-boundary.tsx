import { Component, ComponentType, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/colors';

interface Props {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error | undefined }>;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[backTracker][ErrorBoundary]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      if (Fallback) {
        return <Fallback error={this.state.error} />;
      }
      return (
        <View style={styles.fallback}>
          <Text style={styles.text}>Algo salió inesperado.</Text>
          <Text style={styles.textSecondary}>Vuelve a intentarlo.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark.surface,
  },
  text: {
    color: colors.dark.text,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  textSecondary: {
    color: colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
