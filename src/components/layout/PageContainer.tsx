import type { ReactNode } from "react";

export const PageContainer = ({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) => (
  <section className={`wrap ${className}`} {...rest}>{children}</section>
);
