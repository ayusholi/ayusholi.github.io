import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { HOW_URL } from "@/lib/site";

export const NotFoundPage = () => (
  <>
    <SiteHeader />
    <main id="main" className="wrap pt-12">
      <p className="label mb-3">404 · No such mechanism</p>
      <h1 className="display display--q">We haven&apos;t drawn this one.</h1>
      <p className="lede mt-4 mb-6">That page isn&apos;t in the catalogue. It may have moved, or it may not exist yet.</p>
      <Link className="btn btn--solid" href={HOW_URL}>Back to all topics</Link>
    </main>
    <SiteFooter />
  </>
);
