// What just happened, in words. The `step` column is optional.
export const Caption = ({ title, text, step, id }: { title: string; text: string; step?: number; id?: string }) => (
  <div className={`caption${step === undefined ? " grid-cols-1!" : ""}`} id={id}>
    {step !== undefined && <span className="caption__n">{String(Math.max(step, 0)).padStart(2, "0")}</span>}
    <strong className="caption__t">{title}</strong>
    <span className="caption__d">{text}</span>
  </div>
);
