"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Create a context to manage dialog state
const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>({});

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Dialog = ({ children, open, onOpenChange }: DialogProps) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

// DialogTrigger - Placeholder for compatibility, though not used in controlled mode
const DialogTrigger = ({ children, asChild, ...props }: any) => {
  const { onOpenChange } = React.useContext(DialogContext);
  return React.cloneElement(children, {
    onClick: () => onOpenChange?.(true),
    ...props
  });
}

// DialogContent
const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(DialogContext);
  
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-all duration-100 animate-in fade-in"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content */}
      <div
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          onClick={() => onOpenChange?.(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  )
})
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
