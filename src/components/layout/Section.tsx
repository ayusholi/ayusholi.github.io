import type { ReactNode } from "react";
import { PageContainer } from "./PageContainer";

// A numbered part of a page: a label, a headline, a rule above them.
export const Section = ({ id, label, title, children, anchor }: { id: string; label: string; title: string; children: ReactNode; anchor?: string }) => (
  <PageContainer className="section" id={anchor} aria-labelledby={id}>
    <header className="section__head">
      <span className="label">{label}</span>
      <h2 className="h2" id={id}>{title}</h2>
    </header>
    {children}
  </PageContainer>
);
