import { Archivo, Martian_Mono, Source_Serif_4 } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian" });
const serif = Source_Serif_4({ subsets: ["latin"], axes: ["opsz"], variable: "--font-source-serif" });

export const fontClasses = `${archivo.variable} ${martian.variable} ${serif.variable}`;
