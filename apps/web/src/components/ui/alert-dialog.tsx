/**
 * AlertDialog — thin wrapper over Dialog with AlertDialog naming conventions.
 * Provides a compatible API for destructive confirmation dialogs.
 */
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AlertDialog = Dialog;

function AlertDialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <DialogTrigger render={children} {...props} />;
  }
  return <DialogTrigger {...props}>{children}</DialogTrigger>;
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      className={cn("max-w-md", className)}
      {...props}
    />
  );
}

const AlertDialogHeader = DialogHeader;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;
const AlertDialogFooter = DialogFooter;

function AlertDialogCancel({
  className,
  children = "Cancelar",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogClose
      render={
        <Button variant="outline" className={className} {...props}>
          {children}
        </Button>
      }
    />
  );
}

function AlertDialogAction({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className={className} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
