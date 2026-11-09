import type { Metadata } from "next";
import { HOW_URL } from "@/lib/site";
import { HomePage } from "@/templates/how/home/HomePage";

export const metadata: Metadata = { alternates: { canonical: HOW_URL } };

export default HomePage;
