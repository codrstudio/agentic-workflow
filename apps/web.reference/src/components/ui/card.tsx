import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <div
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
);
Card.displayName = "Card";

export const CardHeader = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <h2 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
);
CardTitle.displayName = "CardTitle";

export const CardDescription = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
CardDescription.displayName = "CardDescription";

export const CardContent = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

export const CardFooter = ({
  className,
  ...props
}: CardProps & { children: ReactNode }) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);
CardFooter.displayName = "CardFooter";
