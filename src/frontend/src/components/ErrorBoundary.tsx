import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error("ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Error boundary caught:", {
      error,
      message: error.message,
      stack: error.stack,
      errorInfo,
      componentStack: errorInfo?.componentStack,
    });

    this.setState({
      errorInfo: errorInfo?.componentStack || "No additional info",
    });
  }

  handleReload = () => {
    console.log("Reloading page...");
    window.location.reload();
  };

  handleReset = () => {
    console.log("Resetting error boundary...");
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "Unknown error";
      const errorStack = this.state.error?.stack || "";

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Wystąpił błąd / Error occurred</CardTitle>
              <CardDescription>
                Coś poszło nie tak. Spróbuj odświeżyć stronę.
                <br />
                Something went wrong. Try refreshing the page.
              </CardDescription>
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Szczegóły błędu / Error details
                </summary>
                <div className="mt-2 space-y-2">
                  <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                    {errorMessage}
                  </pre>
                  {errorStack && (
                    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                      {errorStack}
                    </pre>
                  )}
                  {this.state.errorInfo && (
                    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                      {this.state.errorInfo}
                    </pre>
                  )}
                </div>
              </details>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={this.handleReload}
                className="w-full"
                variant="default"
              >
                Odśwież stronę / Reload page
              </Button>
              <Button
                onClick={this.handleReset}
                className="w-full"
                variant="outline"
              >
                Spróbuj ponownie / Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
