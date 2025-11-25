import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Произошла ошибка
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {this.state.error?.message || 'Неизвестная ошибка'}
            </Typography>
            <Button variant="contained" onClick={this.handleReset}>
              Перезагрузить страницу
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

